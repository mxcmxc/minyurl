const express = require("express"); 
var app = express();
var PORT = process.env.PORT || 8080; 
const bodyParser = require("body-parser"); // parse incoming request bodies in a middleware before handlers
var cookieSession = require('cookie-session'); // encrypt cookies
const bcrypt = require('bcrypt'); // encrypt password

app.set("view engine", "ejs"); // set view engine for node.js

app.use(bodyParser.urlencoded({extended: true})); 

app.use(cookieSession({
  name: 'session',
  keys: ["key1", "key2"],

  // Cookie Options
  maxAge: 24 * 60 * 60 * 1000 // 24 hours
}));

//====================DATABASE===================//

var urlDatabase = {
  "b2xVn2": {
    longURL: "http://www.reddit.com",
    userID: "userRandomID"
  },
  "9sm5xK": {
    longURL: "http://www.google.com",
    userID: "user2RandomID"
  },
  "6dm6pa": {
    longURL: "http://www.github.com",
    userID: "user3RandomID"
  }
};

const users = {
  "userRandomID": {
    id: "userRandomID",
    email: "user@example.com",
    password: bcrypt.hashSync("1234", 10)
  },
  "user2RandomID": {
    id: "user2RandomID",
    email: "user2@example.com",
    password: bcrypt.hashSync("1234", 10)
  },
  "user3RandomID": {
    id: "user3RandomID",
    email: "user3@example.com",
    password: bcrypt.hashSync("1234", 10)
  }
};

//====================FUNCTIONS====================//
// Function to generate a random 6 digit alphanumeric string for id and short URL
function generateRandomString() {
  var output = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 6; i++) {
    output += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return output;
}

// Function to verify user credentials; compare email and pw on database and what was entered
function verifyUserLogin(email, password) {
  for (let user in users) {
  if (users[user].email === email && bcrypt.compareSync(password, users[user].password)) {
      return users[user];
    }
  }
};

// Function to show only short URLs that belong to the user
function urlsBelongUser(id) {
  const urls = {};
  for (let shortURL in urlDatabase) {
    if (urlDatabase[shortURL].userID === id) {
      urls[shortURL] = urlDatabase[shortURL];
    }
  }
  return urls;
}

//====================GET HANDLERS====================//

// Show the urlDatabase as JSON
app.get("/urls.json", function(request, response) {
  response.json(urlDatabase);
});

// When path is /, if user is logged in, redirect to /urls, otherwise redirect to login page
app.get("/", function (request, response) {
  let user = users[request.session.user_id];
  if (!user) {
    return response.redirect("/login");
  }
    response.redirect("/urls");
});

// Renders urls_index page where user can see  list of short URLs
app.get('/urls', function(request, response) {
  let user = users[request.session.user_id]; // check if there is a cookie and if so, send back that user's info
  if (!user) {
    return response.status(403).send("Error: User must be logged in to view URLs");
  }
  let templateVars = {
    user: user,
    urls: urlsBelongUser(user.id)
  };
  response.render("urls_index", templateVars);
});

// Page to create a new short URL, redirects to login if user is not logged in 
app.get("/urls/new", function(request, response) {
  let user = users[request.session.user_id];
  if (!user) {
    return response.redirect("/login");
  }
  let templateVars = {
    user: user
  };
  response.render("urls_new", templateVars);
});

// User's personal short URL page to edit and delete the short URL
app.get('/urls/:id', function(request, response) {
  let user = users[request.session.user_id];
  if (!user) {
    response.status(403).send("Error: User must be logged in to edit URL");
  }
  if (urlDatabase[request.params.id] === undefined) {
    response.status(404).send("Error: URL not found");
  }
  // Check if URL belongs to user
  if (user.id !== urlDatabase[request.params.id].userID) {
    response.status(403).send("Error: User not authorized to edit URL");
  } else {
      let templateVars = {
        user: users[request.session.user_id],
        shortURL: request.params.id,
        longURL: urlDatabase[request.params.id].longURL
      };
      response.render("urls_show", templateVars);
    }
 });

// Short URL that can be accessed by anyone and takes you to the long URL page, no login required. Redirect to error message if the short URL does not exist
app.get("/u/:shortURL", function(request, response) {
  if (urlDatabase[request.params.shortURL === undefined]) {
    response.status(400).send("Error: URL does not exist");
  } else {
    let longURL = urlDatabase[request.params.shortURL].longURL;
    response.redirect(longURL);
  }
});

// Registration page
app.get("/register", function(request, response) {
  let user = users[request.session.user_id];
  if(user) {
    response.redirect("/urls");
  }
  let templateVars = {
    user: users[request.session.user_id],
    urls: urlDatabase
  };
  response.render("register", templateVars);
});

// Login page for existing users
app.get("/login", function(request, response) {
  let templateVars = {
    user: users[request.session.user_id]
  };
  let user = users[request.session.user_id];
  if (user) {
    response.redirect("/urls");
  }
    response.render("login", templateVars);
});

//====================POST HANDLERS====================//

// Creates short URL when long URL is posted. User must be logged in */
app.post("/urls", (request, response) => {
  let user = users[request.session.user_id];
  let shortURL = generateRandomString();
  let longURL = request.body.longURL;
  if (!user) {
    response.status(403).send("Error: User must be logged in to edit URL");
    response.redirect("/");
  }
  while (urlDatabase[shortURL] !== undefined) {
    shortURL = generateRandomString();
  }
  urlDatabase[shortURL] = {
    longURL: request.body.longURL,
    userID: user.id
  }
  response.redirect(`http://localhost:8080/urls/${shortURL}`);
});

// Update and edit the short URL and redirect to long URL
app.post("/urls/:id", function(request, response) {
  let currKey = request.params.id;
  let newlongURL = request.body.longURL;
  let user = users[request.session.user_id];
  if (user.id !== urlDatabase[currKey].userID) {
    return response.status(403).send("Error: User not authorized to edit URL");

  }
  urlDatabase[currKey].longURL = newlongURL;
  response.redirect("/urls");
});

// Delete the short URL from urlDatabase
app.post("/urls/:id/delete", function(request, response) {
  let user = users[request.session.user_id];
  let currKey = request.params.id;

  //Check if URL belongs to user
  if(user.id !== urlDatabase[currKey].userID) {
    return response.status(403).send("Error: User not authorized to delete URL");
  }
  delete urlDatabase[currKey];
  response.redirect("/urls");
});

// Login page for users,check if user exists in database and prompts for register if user does not exist or redirects to /urls if already logged in
app.post("/login", function(request, response) {
  let user = verifyUserLogin(request.body.email, request.body.password);
  if (user == undefined) {
    return response.status(403).send("Error: Invalid email and/or password");
  }
  request.session.user_id = user.id;
  response.redirect("/urls");
});

// Handle logout, delete cookie and redirect to /
app.post("/logout", function(request, response) {
  request.session = null; // delete cookie
  response.redirect("/");
});

// Register new user to database with bcrypt and hashed password
app.post("/register", function(request, response) {
  let email = request.body.email;
  let password = request.body.password;
  let hashedPassword = bcrypt.hashSync(password, 10);

  // Check email and password is not empty
  if (email === "" || password === "") {
    return response.status(400).send("Email and/or password cannot be empty");
  }
  // Check email is unique
  for (user in users) {
    if (users[user].email === email) {
      return response.status(400).send("Error: email already exists");
    }
  }
  // Generate a new userID
  let id = generateRandomString();
  // Add new user to database
  users[id] = {
    id: id,
    email: email,
    password: hashedPassword
  };
  // set username cookie
  request.session.user_id = id; // set cookie

  //verify in terminal password encryption is working
  console.log("What User Database Object Contains: \n", users);

  response.redirect("/urls");
});


app.listen(PORT, function() {
  console.log(`Listening on port ${PORT}...`);
})
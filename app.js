require('dotenv').config();
const express = require("express");
const app = express();
const bodyParser = require("body-parser");
var _ = require('lodash');
const mongoose = require('mongoose');
const { redirect } = require("express/lib/response");
const session = require("express-session");
const passport = require("passport");
const passportlocalmongoose = require("passport-local-mongoose");
const res = require("express/lib/response");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');
let firstname="";




app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: false }));

app.use(session({
    secret: "secret for salt.",
    resave: false,
    saveUninitialized: false
}))

app.use(passport.initialize());
app.use(passport.session());


mongoose.connect('mongodb://127.0.0.1:27017/TODO');



const itemschema = {
    name: String,
};
const item = mongoose.model('Item', itemschema);


const item1 = new item({ name: "Welocme to TODO APP." });
const item2 = new item({ name: "Press + icon to add item." });
const item3 = new item({ name: "Press checkbox to delete." });


const defaultitems = [item1, item2, item3];

const listschema = {
    name: String,
    theme: String,
    items: [itemschema]
};

const List = mongoose.model('List', listschema);

const userSchema = new mongoose.Schema({
    email: String,
    fullname: String,
    googleId:String,
    password: String,
    lists: [listschema]
});

userSchema.plugin(passportlocalmongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, {
        id: user.id,
        username: user.username,
        picture: user.picture
      });
    });
  });
  
  passport.deserializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, user);
    });
  });
  
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/todo",
    userProfileURL: 'https://www.googleapis.com/oauth2/v3/userinfo',
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    firstname=profile.displayName.split(" ")[0];
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
        User.findOne({googleId:profile.id},(err,result)=>{
           result.fullname= profile.displayName,
           result.lists=[{name:firstname+"'s notes",theme:"yellow",items:defaultitems}] 
        })
        return cb(err, user);
    });
  }
));





app.get("/", (req, res) => {
    if (req.isAuthenticated()) {
        res.redirect("/"+firstname+"'s notes");
    } else {
        res.redirect("/login");
    }
});

app.get('/auth/google',
passport.authenticate('google', { scope: ['profile'] }));

app.get('/auth/google/todo', 
passport.authenticate('google', { failureRedirect: '/login' }),
function(req, res) {
    // Successful authentication, redirect home.
    res.redirect("/"+firstname+"'s notes");
  });




app.post("/delete", (req, res) => {
    const listname = req.body.lname;
    const delid = req.body.delid;
    if (req.isAuthenticated()) {
        User.findOne({username:req.user.username,"lists.name":listname},(err,result)=>{
            result.lists.forEach((list)=>{
                if(list.name==listname){
                    list.items.splice(list.items.findIndex(a=>a._id==delid),1);

                }})
                result.save();
        })
        res.redirect("/" + listname);
    } else {
        res.redirect("/login");
    }
    
});

app.post("/theme",(req,res)=>{
    const listname = req.body.listname;
    const newc = req.body.themec;
    if (req.isAuthenticated()) {
        User.findOne({username:req.user.username,"lists.name":listname},(err,result)=>{
            result.lists.forEach((list)=>{
                if(list.name==listname){
                    list.theme=newc;

                }})
                result.save();
        })
        res.redirect("/" + listname);
    } else {
        res.redirect("/login");
    }
})



app.post("/add", (req, res) => {
    const customListName = _.capitalize(req.body.newlist);
            res.redirect("/" + customListName); 
});

app.post("/dellist", (req, res) => {
    const delid = req.body.del;
    if (req.isAuthenticated()) {
        User.findOneAndUpdate({username:req.user.username},{$pull:{lists:{_id:delid}}},(err)=>{console.log(err);});
        
     
        res.redirect("/"+firstname+"'s notes");
    } else {
        res.redirect("/login");
    }
    
    
});


// login-signup routes start 

app.get("/login", (req, res) => {
    res.render('login');
});
app.get("/register", (req, res) => {
    res.render('register');
});

app.post("/register", (req, res) => {
    
    firstname=req.body.fname.split(" ")[0];
    User.register({ username: req.body.username, fullname: req.body.fname,lists:[{name:firstname+"'s notes",theme:"yellow",items:defaultitems}] }, req.body.password, (err, user) => {
        if (err) {
            res.render('login');
        } else {
            passport.authenticate("local")(req, res, () => {
                res.redirect("/");
            })
        }
    })
});


app.post("/login", (req, res) => {
    
    const user= new User({
        username:req.body.username,
        password:req.body.password,
    })
    
    req.login(user,(err)=>{
        if(err){
            console.log(err);
        }
        else{
            passport.authenticate("local")(req,res,()=>{
                User.findOne({username:req.body.username},(err,result)=>{
                    firstname=result.fullname.split(" ")[0];
                    
                })
                res.redirect("/");
            })
        }
    })
    
});

app.get("/logout",(req,res)=>{
    req.logout((err)=>{
        if(err){
            console.log(err);
        }
    });
    res.redirect("/");
});

// login-signup routes end 

app.get("/Favicon.ico",(req,res)=>{});
app.get("/:customListName", (req, res) => {
    const customListName = _.capitalize(req.params.customListName);
    
    if (req.isAuthenticated()) {
       
        User.findOne({username:req.user.username,"lists.name":customListName},(err,result)=>{
            
            if(result){
                
                result.lists.forEach((list)=>{
                    if(list.name==customListName){
                        if (!err) {
                            res.render("todo", { ListName: list, itemlist: list.items, list: result.lists });
                        }
                    }})
                }else{
                    User.findOne({username:req.user.username},(err,result)=>{
       
                    // console.log("ammi");
                    const nlist= new List({name:customListName,theme:"yellow",items:defaultitems});
                    result.lists.push(nlist);
                    result.save();
                })
                res.redirect("/"+customListName);
                }
           
        });
    } else {
        res.redirect("/login");
    
    }
});

app.post("/:customListName", (req, res) => {
    const listname = req.body.add;
    const newitem = req.body.inputitem;
    const itemadded = new item({ name: newitem });
    if (req.isAuthenticated()) {
         User.findOne({username:req.user.username,"lists.name":listname},(err,result)=>{
            result.lists.forEach((list)=>{
                if(list.name==listname){
                    list.items.push(itemadded);
                    result.save();
                }
            })
        });
        res.redirect("/"+listname);

    } else {
        res.redirect("/login");
    
    }
});


app.listen(3000, (err) => {
    if (err) {
        console.log(err);
    }
    else {
        console.log("App successfully running on port 3000.");
    }

})
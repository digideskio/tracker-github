var whacko = require("whacko");
var io = require("./io-promise");

if (process.argv[2] === undefined) {
  console.error("You're missing the link to all tracker issues");
  process.exit(1);
}

var products = [];
// ensure uniq products
function getProduct(name) {
  for (var i = 0; i < products.length; i++) {
    var current_element = products[i];
    if (current_element.name === name) {
      return current_element;
    }
  }
  var obj = {};
  obj.name = name;
  products.push(obj);
  return obj;
}

// products.json can contain preconfiguration for products
io.readJSON("products.json").then(function (data) {
  products = data;
}).catch(function () {
  // products.json doesn't exist or is unreadeable, so create an empty one
  products = [];
}).then(function () {
  return io.fetch(process.argv[2]).then(function(res) {return res.text();})
//  return io.read("issues.html")
      .then(function (data) {
        console.log("Got data");
        return data;
      }).then(function (data) {
        return whacko.load(data);
    });
}).then(function (document) {
    var issues = [];
    document("tbody").children().each(function () {
      var position = 0;
      var obj = {};
      obj.state = "UNKNOWN";
      document(this).children().each(function () {
        var td = document(this);
        if (position === 0) {
          var anchor = td.find("a").first();
          obj.url = "http://www.w3.org" + anchor.attr("href");
          obj.number = anchor.text().substring(6);
        } else if (position === 1) {
          obj.state = td.text().toLocaleLowerCase();
        } else if (position === 2) {
          obj.title = td.text();
        } else if (position === 3) {
          obj.date = td.text();
        } else if (position === 4) {
          obj.product = getProduct(td.text());
        } else if (position === 5) {
          var text = td.text();
          if (text !== "0") {
            obj.actions = text;
          }
        } else {
          console.log("IGNORED " + obj.issue + " " + td.text());
        }
        position++;
      });
      io.save("products.json", products);
      issues.push(obj);
    });
    return issues;
}).then(function (issues) {
  console.log("Found " + issues.length + " tracker issues.");
}).catch(function (err) {
   console.log(err);
   console.log(err.stack);
});

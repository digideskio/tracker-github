var whacko = require("whacko");
var io = require("./io-promise");

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

// convert a tracker issue html page into a JS object
function convertTracker(htmlstring) {
  var document = whacko.load(htmlstring);
  var obj = {};
  document("dt").each(function () {
    var dt = document(this).text();
    var dd = document(this).next();
    if (dt === "State:") {
      obj.state = dd.text();
    } else if (dt === "Product:") {
      obj.product = dd.text();
    } else if (dt === "Raised by:") {
      obj.raisedBy = dd.text();
    } else if (dt === "Opened on:") {
      obj.openedOn = dd.text();
    } else if (dt === "Description:") {
      obj.description = dd.text().trim();
    } else if (dt === "Related Actions Items:") {
    } else if (dt === "Related emails:") {
    } else {
      console.log(dt);
    }
  });
  return obj;
}

var settings = {};
settings.delay = 2; // let's be nice to W3C

// iterate through issues to add additional information
function iter(issues, index) {
  var issue = issues[index];
  var process =
//     io.fetch(issue.url, settings).then(function(res) {return res.text();})
   io.read("files/"+issue.number)
      .then(function (data) {
        console.log("Got " + issue.url);
        return data;
      }).then(convertTracker)
      .then(function (data) {
        if (issue.state !== data.state.toLocaleLowerCase() ||
            issue.product.name !== data.product) {
          throw { err: "You have dirty data", "issue": issue, "data": data};
        }
        // @@ I'm doing something wrong with my JSON serialization
        // ideally I shouldn't need those replace...
        issue.body = data.description
          .replace(/…/g, '...')
          .replace(/“/g, '"')
          .replace(/”/g, '"')
          .replace(/‘/g, "'")
          .replace(/’/g, "'")
          .replace(/§/g, "chapter ")
          .replace(/–/g, "-");
        issue.raisedBy = data.raisedBy;
        issue.openedOn = data.openedOn;
      }).catch(function (err) {
        console.log(err);
      });
  return process.then(function () {
    if (index+1 >= issues.length) {
      return issues;
    } else {
      return iter(issues, index+1);
    }
  });
}

// products.json can contain preconfiguration for products
io.readJSON("products.json").then(function (data) {
  products = data;
}).catch(function () {
  // products.json doesn't exist or is unreadeable, so create an empty one
  products = [];
}).then(function () {
//  return io.fetch(process.argv[2]).then(function(res) {return res.text();})
  return io.read("issues.html")
      .then(function (data) {
        console.log("Got data");
        return data;
      }).then(function (data) {
        io.save("issues-fetched.html", data);
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
  if (issues.length === 0) {
    return issues;
  } else {
    return iter(issues, 0).then(function () {
      return issues;
    });
  }
  // return issues;
}).then(function (issues) {
  io.save("tracker-list.json", issues);
}).catch(function (err) {
   console.log(err);
   console.log(err.stack);
});

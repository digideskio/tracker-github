var io = require('./io-promise');

// settings for HTTP requests
var settings = {};
settings.auth = "<your-token>:x-oauth-basic";
settings.headers = {'user-agent': 'Node.js/w3c-tracker2github'};
settings.delay = 2; // let's be nice to GitHub

var repo = process.argv[2];

function processIssue(issues, idx) {
  var issue = issues[idx];

  if (issue === undefined) {
    throw { message: "No issue found for " + idx, length: issues.length};
  }
  var beacon = {};
  beacon.title = issue.title;
  beacon.body = issue.body +
    "\n\n(raised by " + issue.raisedBy +
    " on " + issue.openedOn +
    ")\nFrom tracker issue " + issue.url;
  beacon.state = issue.state;
  beacon.labels = issue.product.labels;

  var repo = "https://api.github.com/repos/w3c/" +
                    issue.product.repo + "/issues";
  return io.post(repo,
                 beacon,
                 settings)
    .then(function (res) {
      return res.json();
    }).then(function (data) {
      issue.github = data;
      console.log("CREATED " + issue.number + " @ " + issue.github.url);
      return data;
    }).catch(function (err) {
      console.log("FAILED TO ISSUE " + issue.url);
      throw err;
    }).then(function (data) {
      if (beacon.state === "closed") {
        // GitHub doesn't allow to close an issue at creation time
        // so resend the beacon again using PATCH this time
        return io.patch(issue.github.url,
                        beacon,
                        settings)
          .then(function (res) {
            console.log("CLOSED " + issue.number + " @ " + issue.github.url);
            return res.json();
          }).catch(function (err) {
            console.log("FAILED TO CLOSED " + issue.number + " @ " + issue.github.url);
            throw err;
         });
      } // @@do somrthing on pending-review?
      return data; // fallback
    }).catch(function (err) {
      // save the faulty beacon
      io.save("error-beacon-" + issue.number + ".json", beacon);
      throw err;
    }).then(function () {
      if ((idx+1) >= issues.length) {
        return issues;
      } else {
        return processIssue(issues, idx+1);
      }
    });
}

var general_issues;
io.readJSON("tracker-list.json").then(function(data) {
  console.log("Read %d tracker issues", data.length);
  general_issues = data;
  return data;
}).then(function (issues) {
  // only keep issues to be created on github
  return issues.filter(function (issue) {
    if (
      // we already those
      issue.github !== undefined ||
      // no repo set for this issue
      issue.product.repo === undefined ||
      // argv[2] is used for a specific subset
      (repo !== undefined && issue.product.repo !== repo)) {
      return false;
    }
    return true;
  });
}).then(function (issues) {
  if (issues.length > 0) {
    console.log("Sending " + issues.length + " to github.")
    return processIssue(issues, 0);
  } else {
    return 0;
  }
}).catch(function (err) {
  console.log("oops");
  console.log(err);
}).then(function () {
  return io.save("tracker-list.json", general_issues);
}).then(function () {
  console.log("All done");
}).catch(function (err) {
  console.log("reoops");
  console.log(JSON.stringify(err));
});

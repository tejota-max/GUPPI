require('dotenv').config()

const subreddit = process.env.subreddit;
const guppi_trigger = process.env.trigger;
const snoowrap = require('snoowrap');
const fs = require('fs');

const requestor = new snoowrap({
  userAgent: process.env.userAgent,
  clientId: process.env.clientId,
  clientSecret: process.env.clientSecret,
  username: process.env.username,
  password: process.env.password
});

const guppi_version = '1.0.3';

const guppi_greetings = [
  "I live to serve",
  "By your command",
  "Affirmative!",
  "(eye roll)"
];

const guppi_commands = [
  "commands", // descending length order for inclusive substr check
  "man",
  "help",
  "books"
];

// https://stackoverflow.com/questions/4550505/getting-a-random-value-from-a-javascript-array
const random = () =>  Math.floor(Math.random() * guppi_greetings.length);

const replyToComment = (commentId, msg) => {
  requestor.getComment(commentId)
    .reply(
      `ver.${guppi_version}` + ' | ' + guppi_greetings[random()] + '\n\n' +
      msg
    );
}

const soDate = () => new Date().toLocaleString('en-US', {
  timeZone: "America/Chicago"
}).slice(0, 10);

// limit any checks against the start of today to reduce computation/API calls
const todayEpoch = Math.floor((new Date(soDate()).valueOf())/1000);

const addRespondedEntry = (parentId, commentId) => {
  try {
    const currentEntriesText = fs.readFileSync('responded.json', 'utf8');
    const currentEntries = currentEntriesText ? JSON.parse(currentEntriesText) : {};

    if (parentId in currentEntries) {
      currentEntries[parentId].push(commentId);
    } else {
      currentEntries[parentId] = [commentId];
    }

    // TODO: this will fail if the responded.json file doesn't exist
    // this was using append, will update
    fs.writeFileSync('responded.json', JSON.stringify(currentEntries));
  } catch (e) {
    console.log('failed to write to responded.json');
    console.log(e);
  }
}

const replyToCommentWithDelay = (parentId, commentId, msg) => {
  return new Promise(resolve => {
    replyToComment(commentId, msg);
    addRespondedEntry(parentId, commentId); // assumes succeeded
    setTimeout(() => {
      resolve(true);
    }, 2000);
  });
}

const respondToTriggers = (foundTriggers) => {
  const respondedText = fs.readFileSync('responded.json', 'utf8').trim();
  const responses = respondedText ? JSON.parse(respondedText) : {};

  let sendCheckCounter = 0;

  // condense by checking against responded
  foundTriggers.forEach(async trigger => {
    sendCheckCounter += 1;

    const parentEntry = trigger.parentId in responses;

    if (!parentEntry || (parentEntry && responses[trigger.parentId].indexOf(trigger.commentId) === -1)) {
      console.log(`replying..., ${Date.now()}`);
      await replyToCommentWithDelay(trigger.parentId, trigger.commentId, trigger.msg);
    }

    if (sendCheckCounter === foundTriggers.length) {
      // last run
      setTimeout(() => {
        getNewComments();
      }, 5000);
    }
  });
}

const scriptEnabled = fs.readFileSync('onOff.txt', 'utf8').trim();

const getBooks = () => {
  const books = fs.readFileSync('./books.txt', {encoding: 'utf8', flag: 'r'});
  return books ? books.split('\n').join(' ___ ') : 'book list get err';
}

const guppi_responses = {
  "commands": `help, man, commands -- show available commands \n\n
  books -- recommended books`,
  "books": getBooks()
}

const respMatch = (command) => {
  let resp = "";

  switch (command) {
    case "man":
    case "help":
    case "commands":
      resp = guppi_responses.commands;
      break;
    case "books":
      resp = guppi_responses.books;
      break;
    default:
      resp = guppi_responses.commands;
  }

  return resp;
}

const findResp = (body) => {
  // oof double loop
  for (let i = 0; i < guppi_commands.length; i++) {
    const command = guppi_commands[i];

    if (body.indexOf(command) !== -1) {
      return respMatch(command);
    }
  };

  return guppi_responses.commands;
}

const getNewComments = () => {
  if (scriptEnabled === "off") {
    console.log('script disabled');
    return;
  }

  requestor.getSubreddit(subreddit).getNewComments().then(res => {
    const foundTriggers = [];

    res.forEach(res => {
      const resBody = res.body.replace(/\\/g, '');
      if (res.created > todayEpoch && resBody.indexOf(guppi_trigger) !== -1) {
        foundTriggers.push({
	        parentId: res.parent_id,
          commentId: res.id,
          msg: findResp(resBody)
        });
      }
    });

    // process found triggers
    if (foundTriggers.length > 0) {
      respondToTriggers(foundTriggers);
      console.log(`checked on ${Date.now()} found triggers`);
    } else {
      console.log(`checked on ${Date.now()} no triggers`);
      setTimeout(() => {
        getNewComments();
      }, 5000); // 5 second delay between runs
    }
  });
}

// this script is ran by something like systemd/pm2
// it is kept going by recursion
// the onOff.txt file can stop the getNewComments() loop
// the snoowrap library is supposedly rate limited
// but this will be additional rate limiting
// there's a figure like 30 requests per minute so 1 request every 2 seconds?
// but the processing will add delays like each response to a comment will have a delay

getNewComments();

### About

A bot for the /r/bobiverse subreddit.

### Trigger string
!GUPPI_2

### Make one yourself

### Dependencies

This uses [snoowrap](https://github.com/not-an-aardvark/snoowrap) to authenticate and make requests to Reddit

#### Requirements
* you need a (bot) reddit account, that will do the posting
* you need to then go [here](https://ssl.reddit.com/prefs/apps/) while logged into this new bot account and register your script
  * `redirect uri` is required but it can be whatever, I just used `http://localhost:5000`
* have `NodeJS` installed on your computer or server
* clone this repo, run `npm install` and create/fill out a `.env` file with the required bot info

### Versions

#### V1
- grab new comments in subreddit by date ascending order
- iterate over the new comments
- if responding, take note of thread and comment id to make sure not double responding
  - data store is a file, no db yet, easy to add mysql but no time right now
- respond to any calls with basic message, no pattern yet

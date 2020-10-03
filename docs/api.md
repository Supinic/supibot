# API
Supibot exposes some of its data as endpoints on the Supinic API.
Documentation can be found [here](https://supinic.com/api). The base endpoint is **supinic.com/api**
Make sure to read the [guide](https://supinic.com/api/#api-_) on authorization!

### AFK
It is possible to set and unset one's AFK status via the API, with proper authorization.
Otherwise, it is possible to check others' AFK status, in bulk as well.

 - [Check if user is AFK](https://supinic.com/api/#api-Bot-CheckAFK)
 - [Check if multiple users are AFK](https://supinic.com/api/#api-Bot-CheckMultipleAFK)
 - [Get a list of all active AFK statuses](https://supinic.com/api/#api-Bot-GetAFK)
 - [Post an AFK status for yourself](https://supinic.com/api/#api-Bot-PostAFK)
 - [Unset your AFK status](https://supinic.com/api/#api-Bot-UnsetAFK)

### Reminder
Setting an unsetting a reminder is also possible via the API. 
It is still subject to regular limits for incoming and outgoing reminders, private and public alike.
Unlike AFK statuses, reminders are not public and so only reminders created by you or targeted at you are able to be inspected.

 - [Create a new reminder](https://supinic.com/api/#api-Bot-CreateReminder)
 - [List all your reminders](https://supinic.com/api/#api-Bot-ListReminders)
 - [Unset an active reminder](https://supinic.com/api/#api-Bot-UnsetReminder)
  
### Other endpoints
- [List channels](https://supinic.com/api/#api-Bot-GetChannelList)
- [Check opt-outs](https://supinic.com/api/#api-Bot-CheckFilterStatus)
- [List all commands](https://supinic.com/api/#api-Bot-GetCommandList)
- [Fortune cookie stats for a user](https://supinic.com/api/#api-Bot-GetCookieStatus)
- [Fortune cookie stats globally](https://supinic.com/api/#api-Bot-ListCookieStats)

### Stream-related endpoints
These endpoints work with [my stream](https://twitch.tv/supinic) on Twitch.

- [List playsounds](https://supinic.com/api/#api-Stream-GetPlaysoundList)
- [Check playsounds status](https://supinic.com/api/#api-Stream-GetPlaysoundEnabled)
- [Song requests - status](https://supinic.com/api/#api-Stream-GetSongRequestQueue)
- [Song requests - queue](https://supinic.com/api/#api-Stream-GetSongRequestState)

rsync-backup
======================

backup local folders using rsync

## What does it do
This package allows you to backup your files and folders using node.js & rsync. You can set a parent folder and have it 
backup all folders underneath. It creates a copy of the underlying data as well as an archive of those data. You can set
the number of archives you want to keep (for example one for each day of the week) as well as the number of parallel 
operations to execute (for example backup 5 folders at a time). 

## Install
```
npm install rsync-backup

Then rename the config.sample.json to config.json and edit it with your own settings. 
Finally you can edit the excludeList.txt to add any exclusions you might have.

```

## Basic usage

```
node index --src="/my-folder-to-backup"
```

## Recursive usage.
 
```
node index --src="/my-folder-to-backup" --recursive="true"
```

## Exclude file or folders
You can exclude as many files or folder you want. Just add them in the excludeList.txt (one file or folder per line)

## Logs
When the backup process is done a complete log is saved under the "logsDir" folder. You can check it to verify that
rsync is including your files as it should, as well as if it is excluding files as it should.

### Warning!!!
The parallel operations mode consumes a lot of resources, especially disk time. If you're using it on a live server, experiment
first cause it might cause high load.


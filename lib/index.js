var util  = require('util'),
    exec = require('child_process').exec,
    fs = require('fs-extra'),
    path = require('path');
var async = require('async');
var colors = require('colors');
var moment = require('moment');
var argv = require('minimist')(process.argv.slice(2));
var spawn = require('child_process').spawn;

var Config = require('../config.json');

var basePath = (typeof argv.src == 'undefined') ? __dirname : argv.src;
var dest = (typeof argv.dest == 'undefined') ? Config.defaultDestination : argv.dest;
var numBackups = (typeof argv.num == 'undefined') ? Config.numberOfBackups : argv.num;
var recursive = (typeof argv.recursive == 'undefined') ? Config.recursive : argv.recursive;
var logsDir = (typeof argv.logsDir == 'undefined') ? Config.logsDir : argv.logsDir;
var ExcludeList = require('../excludeList.json');

if (!fs.existsSync(logsDir)){
    fs.mkdirSync(logsDir,0755);
}

if (!fs.existsSync(Config.archiveLocation)){
    fs.mkdirSync(Config.archiveLocation,0755);
}

var foldersFound = [];
/*
 * TODO: add ignore list for folders
 */
var output = {
    rsync : '',
    tarball : ''
};

async.series([
    function(callback){
        readDir(function(err,res){
            callback(null,'dirRead');
        });
    },
    function(callback){
        performBackUp(function(err,res){
            callback(null,'BackupDone');
        });
    }
],function(err,endResult){
    console.log(colors.green('All done here'),endResult);
});


function readDir(callback){
    if (!recursive){
        foldersFound.push(basePath);
        callback(null,[basePath]);
        return;
    }

    fs.readdir(basePath,function(err,files){

        for (var a in files){
            var file = basePath + '/' + files[a];
            var stats = fs.statSync(file);


            if (stats.isDirectory()){
                foldersFound.push(file);
            }
        }

        callback(null, foldersFound);
    });
}

function performBackUp(callback){
    var folders = foldersFound;
    console.log(colors.green('Backing up ' + folders.length + ' folders'));
    console.log('------------------');
    var asyncArr = [];
    console.log(folders);
    for (var a in folders){
        asyncArr.push(function(folder,callback){
            backupFolder(folder,function(err,result){
                callback(null,result);
            });
        }.bind(null,folders[a]));
    }

    async.parallelLimit(asyncArr,Config.parallelOperations,function(err,done){
        console.log(colors.green(done.length + ' folders backed up'));
        callback(null,done);
    });
}

function backupFolder(folder,backUpCB){

    //execute backup
    var myName = path.basename(folder);
    var destFolder =  dest + '/' + myName;
    var logDir = logsDir + '/' + path.basename(folder);
    var logFile = logDir + '/' + myName + '-' + moment().format('M-D-YYYY-HH-mm') + '.log';

    if (!fs.existsSync(destFolder)){
        fs.mkdirSync(destFolder,0755);
    }

    var pack = {
        myName : myName,
        destFolder : destFolder,
        logDir : logDir,
        logFile : logFile,
        folder : folder
    };

    var asyncArr = [];

    if (Config.useRsync){
        asyncArr.push(runRsync.bind(null,pack));
    }

    if (Config.numberOfBackups != 0){
        asyncArr.push(createTarball.bind(null,pack))
    }

    async.series(asyncArr,function(err,result){
        backUpCB(null,result);
    });

}

function runRsync(item,cb){
    console.log(colors.yellow('Rsyncing folder ' + item.folder ));
    var command = 'rsync -avurvt --progress --delete ' ;
    if (Config.excludeFrom){
        command += " --exclude-from=" + Config.excludeFrom + "  ";
    }

    command += item.folder + ' ' + item.destFolder;

    var cmd = parseCommand(command);
    var run = spawn(cmd[0], cmd[1]);

    run.stdout.on('data', function(data) {
        output.rsync += data.toString();
    });

    run.on('close', function(code) {
        writeLog(item.folder,item.logDir,item.logFile,output.rsync,function(err,result){
            cb(null, item.folder);
        });
    });
}

function createTarball(item,cb){

    if (!fs.existsSync(Config.archiveLocation + '/' + item.myName)){
        fs.mkdirSync(Config.archiveLocation + '/' + item.myName,0755);
    }


    var dir = Config.archiveLocation + '/' + item.myName + '/';
    var files = fs.readdirSync(dir)
        .map(function(v) {
            return { name:v,
                time:fs.statSync(dir + v).mtime.getTime()
            };
        })
        .sort(function(a, b) { return a.time - b.time; })//sort by date created
        .map(function(v) { return v.name; });

    if (files.length >= Config.numberOfBackups){
        var total = files.length-Config.numberOfBackups;
        var toDelete = files.splice(0,total);
        //delete old files
        for (var a in toDelete){
            fs.unlinkSync(dir + toDelete[a])
        }
    }


    var archive = Config.archiveLocation + '/' + item.myName + '/' + item.myName + '-' + moment().format('M-D-YYYY-HH-mm')+ '.tar.gz';
    var command = 'tar -zcf ' + archive + ' ' + item.folder;
    var cmd = parseCommand(command);
    console.log(colors.yellow('Packing ' + item.folder));
    var run = spawn(cmd[0], cmd[1]);


    run.stdout.on('data', function(data) {
        output.tarball += data.toString();
    });

    run.on('close', function(code) {
        writeLog(item.folder,item.logDir,item.logFile,output.tarball,function(err,result){
            console.log(colors.green('Packing ' + item.folder + ' done'));
            cb(null, item.folder);
        });
    });



}

function writeLog(folder,logDir,logFile,data,callback){
    if (!fs.existsSync(logDir)){
        fs.mkdirSync(logDir,0755);
    }

    fs.appendFile(logFile,data,function(err){
        console.log(colors.green(folder + ' done...'));
        callback(null,folder);
    });
}

function parseCommand(cmd)
{
    var cmdA = cmd.split(/ /);

    var cmd1 = cmdA[0];
    var args1 = [];
    cmdA.map(function(s, i)
    {
        if (i === 0)
        {

        }
        else
        {
            args1[i - 1] = cmdA[i].replace(/_@_/g, ' ');
        }
    });
    return [cmd1, args1];
}

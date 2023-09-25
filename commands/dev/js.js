const VM  = require("isolated-vm");

let isolate;
let context;
let jail;
let contextObject = { };
let returnScript;

module.exports = {
    name: "js",
    description: "Arbitrary code execution on demand.",
    guildOnly: false,
    dmOnly: false,
    permissions: null,
    args: false,
    setContext(contextToSet) {
        contextObject = contextToSet;
        isolate = new VM.Isolate({ memoryLimit: 1024});
        context = isolate.createContextSync();
        jail = context.global;
        jail.setSync('global',jail.derefInto());
        jail.setSync('id', 0);
        jail.setSync('VM', VM);
        jail.setSync('listenerArr', new VM.ExternalCopy([]).copyInto());
        context.evalSync("output = {};");
        context.evalSync(`on = function(regex, func) {
            const l = { regex, func, id: ++id };
            listenerArr.push(l);
            return l.id;
        }`);
        context.evalSync(`onmsg = function(msg) {
            listenerArr.map(l => {
                let match = msg["content"].match(l.regex);
                if (match !== null) {
                    l.func(msg, ...match.slice(1));
                }
            });
        }`);
        context.evalSync(`getGlobalString = function() {
            return JSON.stringify(global, function(key, value) {
                if(key == 'global') {return value.id;}
                else {return value;}
            });
        }`)

        context.evalSync('listenerArrCheck = match => listenerArr.filter(l => match.test(l.regex.source)).map(l => `${l.id}: ${l.regex}`).join(", ");');
        context.evalSync(`findFuncByID = idCheck => listenerArr.find(x => x.id === idCheck).func.toString();`);
        context.evalSync(`removeListenerByID = function(id) {
            let index = listenerArr.findIndex(x => x.id === id);
            if (index !== -1) {
                let removed = listenerArr.splice(listenerArr.findIndex(x => x.id === id),1);
                return removed.map(l => \`${l.id}: ${l.regex}\`).join(", ");
            } else {
                return "No listener with that ID, sorry!";
            }
        }`);
        Object.keys(contextObject).forEach((value) => {
            console.log(value + " " + contextObject[value])
            if (typeof contextObject[value] == "number" || 
                typeof contextObject[value] == "string" || 
                typeof contextObject[value] == "boolean") {
                jail.setSync(value, contextObject[value]);
            } else if (typeof contextObject[value] == "object") {
                jail.setSync(value, new VM.ExternalCopy(contextObject[value]).copyInto());
            } else {
                throw Error;
            }
        });
    },
    passMsg(msg) {
        jail.setSync("newMsg", new VM.ExternalCopy(msg).copyInto());
        context.evalSync(`newMsg.reply = function(text) {
            this.replyVal.push(text);
        }`);
        context.evalSync("onmsg(newMsg)");
        returnScript = isolate.compileScriptSync(`
            output = new VM.ExternalCopy(newMsg.replyVal).copyInto();
        `);
        let tempResult = returnScript.runSync(context);
        console.log(tempResult);
        return tempResult;
    },
    execute(args, commandCaller, guildEnv, channelEnv) {
        //console.log(args);
        //jail.setSync("tempFunc", msg => msg.reply("hey"));
        //const result = context.evalSync("on(/wow/,tempFunc)");
        const result = context.evalSync(args);
        if ((typeof result) == "number" || (typeof result) == "boolean") {
            return result.toString();
        } else if ((typeof result) == "string") {
            return result;
        } else if ((typeof result) == "object") {
            return JSON.stringify(result);
        } else if ((typeof result) == "function") {
            return "Function, which I can't stringify!";
        } else if ((typeof result) == "array") {
            return result.toString();
        } else if ((typeof result) == "undefined") {
            return "Undefined, but something happened!";
        }
    },
};
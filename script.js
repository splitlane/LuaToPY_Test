/*
    runtime.js

    Runtime library for LuaToJS, Contains all of the lua functions written in JS

    WARNING: Minify for production

    Taken from old LuaToJS (Code (Summer 2023)) and worked on

    https://github.com/teoxoy/lua-in-js
        https://github.com/teoxoy/lua-in-js/tree/master/src/lib
*/




var RuntimeInternal = {
    Mode: 'browser', // Options: 'node', 'browser'
    Fengari: {}
};




// os.clock

RuntimeInternal.msSinceStart = performance.now();


// https://dev.to/arthurbiensur/kind-of-getting-the-memory-address-of-a-javascript-object-2mnd

// Get "unique" memory address
// Modified to not pollute the global namespace

{
    //This generator doesn't garantee uniqueness, but looks way more memoryish than a incremental counter
    //if you use this code for real, do incremental or something else unique!
    let generator = function*() {
    while (true) {
        const random = Math.random()
        .toString(16)
        .slice(2, 10);
        yield `0x${random}`;
    }
    }

    let preload = (knowObjects, refs, generate) => (reference = false) => {
    if (reference) {
        return refs;
    } else {
        return object => {
        let address;
        if (knowObjects.has(object)) {
            address = knowObjects.get(object);
        } else {
            address = generate.next().value;
            knowObjects.set(object, address);
            refs[address] = object;
        }
        return address;
        };
    }
    };

    RuntimeInternal.findRef = (preload(new Map(), {}, generator()))(false);
}


// Is true in lua?

// NOTE: In lua, 0 and '' are truthy, while in js, no

{
    RuntimeInternal.isFalse = function(o) {
        if (o === false || o === null || o === undefined) {
            return true;
        } else {
            return false;
        }
    }
    RuntimeInternal.isTrue = function(o) {
        return !RuntimeInternal.isFalse(o);
    }
}


// https://stackoverflow.com/questions/46611353/javascript-is-there-an-equivalent-of-luas-g-in-javascript

// _G
{
    RuntimeInternal.getGlobal = function () {
        // the only reliable means to get the global object is
        // `Function('return this')()`
        // However, this causes CSP violations in Chrome apps.
        if (typeof self !== 'undefined') { return self; }
        if (typeof window !== 'undefined') { return window; }
        if (typeof global !== 'undefined') { return global; }
    };
}


// metatables (only supports getting, setting, methods don't work)
{
    RuntimeInternal.metatables = {};
}


// ipairsf
{
    RuntimeInternal.ipairsf = function(t, k) {
        if (k) {
            k = k + 1;
            if (t[k] == undefined) {
                return [];
            } else {
                return [k, t[k]];
            }
        } else {
            return [1, t[1]];
        }
    }
}


// tonumber
{
    RuntimeInternal.Digits = {
        '0':true,
        '1':true,
        '2':true,
        '3':true,
        '4':true,
        '5':true,
        '6':true,
        '7':true,
        '8':true,
        '9':true
    };
}


// math.random

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random
{
    RuntimeInternal.getRandom = function(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1) + min); // The maximum is inclusive and the minimum is inclusive
    }
}


// table.sort
{
    RuntimeInternal.defaultSortComparisonf = function(a, b) {
        return a < b;
    }
}


// table (*)
{
    RuntimeInternal.coerceToArray = function(o) {
        if (Array.isArray(o)) {
            // if (o[0] == undefined) {
            //     o[0] = null;
            // }
            return o;
        } else {
            var t = [];
            for (let k in o) {
                t[k] = o[k];
            }

            // if (o[0] == undefined) {
            //     o[0] = null;
            // }
            return t;
        }
    }
}


// print
{
    // WARNING: MAY RESULT IN DATA LOSS
    // lua (Uint8Array) to js (string)
    RuntimeInternal.stringToActualString = function(str) {
        var out = '';
        for (let i = 0; i < str.length; i++) {
            out = out + String.fromCharCode(str[i]);
        }
        return out;
    }
    // lua (Uint8Array) from js (string)
    RuntimeInternal.actualStringToString = function(str) {
        var out = new Uint8Array(str.length);
        for (let i = 0; i < str.length; i++) {
            out[i] = str[i].charCodeAt(0);
        }
        return out;
    }
    // console.log(RuntimeInternal.stringToActualString(RuntimeInternal.actualStringToString('amogus')))
    RuntimeInternal.toActualString = function(o) {
        if (o === true) {
            return 'true';
        } else if (o === false) {
            return 'false';
        } else if (o === null || o === undefined) {
            return 'nil';
        } else if (ArrayBuffer.isView(o)) {
            return RuntimeInternal.stringToActualString(o);
        } else if (typeof o === 'object') {
            return 'table: ' + RuntimeInternal.findRef(o);
        } else if (typeof o === 'function') {
            return 'function: ' + RuntimeInternal.findRef(o);
        } else {
            return String(o);
        }
    }
}









// ASTToJavaScript.js


// UnaryOperator '#'
{
    RuntimeInternal.getLength = function(o) {
        // console.log();
        if (ArrayBuffer.isView(o)) {
            return o.length;
        } else {
            let i = 1;
            while (true) {
                if (o[i] === undefined) {
                    break;
                }
                i++;
            }
            return i - 1;
        }
    }
}


// CallExpression
{
    RuntimeInternal.wrapAmbiguousCall = function(out) {
        if (Array.isArray(out)) {
            return out[0];
        } else {
            return out;
        }
    }
}


// BinaryExpression '..'
{
    RuntimeInternal.concatString = function(str1, str2) {
        // https://stackoverflow.com/a/49129872
        var out = new Uint8Array(str1.length + str2.length);
        out.set(str1);
        out.set(str2, str1.length);
        return out;
    }
}


// StringLiteral
{
    Uint8Array.prototype.toString = function() {
        return RuntimeInternal.toActualString(this);
    };
    Uint8Array.prototype.equals = function(other) {
        // Inspiration: https://gist.github.com/fflorent/e5e85e955a0ddbf8dc62
        if (Object.getPrototypeOf(this) !== Object.getPrototypeOf(other)) {
            return false;
        }
        if (this.length === undefined || this.length !== other.length) {
            return false;
        }

        for (let i = 0; i < this.length; i++) {
            if (this[i] !== other[i]) {
                return false;
            }
        }

        return true;
    }
}


// fs
if (RuntimeInternal.Mode == 'node') {
    RuntimeInternal.oldRequire = require;
}


// RuntimeInternal_VARARG
if (RuntimeInternal.Mode == 'node') {
    RuntimeInternal_VARARG = [];
    let t = process.argv;
    for (let i = 2; i < t.length; i++) {
        RuntimeInternal_VARARG.push(t[i]);
    }
}


// TableConstructorExpression - VarargLiteral
{
    RuntimeInternal.addVararg = function(object, args, starti) {
        for (let i2 = 0; i2 < args.length; i2++) {
            object[starti + i2] = args[i2];
        }
        return object;
    }
    // console.log(RuntimeInternal.addVararg({1: 1, 2: 2}, ['a', 'b'], 3))
}













// _G START


var _G = RuntimeInternal.getGlobal();


var _VERSION = 'Lua 5.1';


function assert(v, msg, ...args) {
    if (RuntimeInternal.isTrue(v)) {
        return [v, msg, ...args];
    } else {
        if (RuntimeInternal.isTrue(msg)) {
            error(msg);
        } else {
            error('assertion failed!');
        }
    }
}


// NONFUNCTIONAL (*)
function collectgarbage(opt, arg) {
    if (opt == undefined || opt == 'collect') {

    } else if (opt == 'stop') {

    } else if (opt == 'restart') {

    } else if (opt == 'count') {
        return [0];
    } else if (opt == 'step') {

    } else if (opt == 'setpause') {
        return [0];
    } else if (opt == 'setstepmul') {
        return [0];
    }
    return;
}


// NONFUNCTIONAL (*), TODO
function dofile(filename) {

}


// NONFUNCTIONAL (level)
function error(message, level) {
    throw Error(message);
}


// NONFUNCTIONAL (*)
function getfenv(f) {

}


// NONFUNCTIONAL (methods)
function getmetatable(o) {
    return RuntimeInternal.metatables[RuntimeInternal.findRef(o)];
}


function ipairs(t) {
    return [RuntimeInternal.ipairsf, t, 0];
}


// NONFUNCTIONAL (*)
function load(func, chunkname) {

}


// NONFUNCTIONAL (*)
function loadfile(filename) {
    
}


// NONFUNCTIONAL (*)
function loadstring(str, chunkname) {
    
}


// NONFUNCTIONAL (*)
function module(name, ...args) {
    // if (typeof package.loaded[name] === 'object') {

    // }
}


// REF, buggy
// function next(t, k) {
//     // Find refs for each key in t
//     var refMap = {};
//     var refList = [];
//     var kref;
//     for (let [k2, v] of Object.entries(t)) {
//         var ref = RuntimeInternal.findRef(k2);
//         refMap[ref] = k2;
//         refList.push(ref);
//         if (k == k2) {
//             kref = ref;
//         }
//     }
//     refList.sort();

//     if (k == undefined) {
//         if (RuntimeInternal.getLength(t) == 0) {
//             return;
//         } else {
//             var k2 = refMap[refList[0]];
//             return [k2, t[k2]];
//         }
//     } else {
//         if (kref) {
//             var index = refList.indexOf(kref);
//             var k2 = refMap[refList[index + 1]];
//             return [k2, t[k2]];
//         } else {
//             error('invalid key to \'next\'');
//             return;
//         }
//     }
// }


function next(t, kc) {
    let keys = Object.keys(t).sort();
    if (kc == null) {
        let k = keys[0];
        return [k, t[k]];
    }
    for (let i = 0; i < keys.length - 1; i++) {
        if (keys[i] == kc) {
            let k = keys[i + 1];
            return [k, t[k]];
        }
    }
    return [];
}


function pairs(t) {
    return [next, t, null];
}


function pcall(f, ...args) {
    var out;
    try {
        out = f(...args);
    }
    catch(err) {
        if (ArrayBuffer.isView(err)) {
            return false, err;
        } else {
            return false, err.name;
        }
    }

    return [true, ...out];
}


function print(...args) {
    var str = '';
    args.forEach(arg => {
        str = str + RuntimeInternal.toActualString(arg) + '\t'
    });
    str = str.substring(0, str.length - 1);
    console.log(str);
    return;
}


function rawequal(v1, v2) {
    return v1 === v2;
}


function rawget(t, k) {
    return t[k];
}


function rawset(t, k, v) {
    t[k] = v;
    return t;
}


// NONFUNCTIONAL (*)
require = function(modname) {

}


function select(index, ...args) {
    if (index == '#') {
        return [args.length - 1];
    } else {
        // var out = [];
        // for (let i = index - 1; i < args.length; i++) {
        //     out.push(args[i]);
        // }
        // return out;
        return args.slice(index - 1)
    }
}


// NONFUNCTIONAL (*)
function setfenv(f, t) {

}


function setmetatable(t, mt) {
    var oldmt = getmetatable(t);
    if (oldmt && oldmt.__metatable) {
        error('cannot change a protected metatable');
    } else {
        RuntimeInternal.metatables[RuntimeInternal.findRef(o)] = mt;
        return t;
    }
}


function tonumber(e, base) {
    if (base == undefined) {
        base = 10;
    }
    if (base == 10) {
        // can have decimal, exponent
        var i = 0;
        var lasti = 0;
        while (RuntimeInternal.Digits[e[i]]) {
            i = i + 1;
        }
        if (e[i] == '.') {
            i = i + 1;
            while (RuntimeInternal.Digits[e[i]]) {
                i = i + 1;
            }
        }
        var data = parseFloat(e.substring(lasti, i));
        if (e[i] == 'e' || e[i] == 'E') {
            i = i + 1;
            var lasti2 = i;
            if (e[i] == '-' || e[i] == '+') {
                i = i + 1;
            }
            while (RuntimeInternal.Digits[e[i]]) {
                i = i + 1;
            }
            var data2 = parseInt(e.substring(lasti2, i));
            // console.log(data, data2)
            data = data * 10 ** (data2);
        }
        i = i - 1;
        
        return data;
    } else {
        // unsigned integer
        return parseInt(e, base);
    }
}


function tostring(o) {
    if (o === true) {
        return 'true';
    } else if (o === false) {
        return 'false';
    } else if (o === null || o === undefined) {
        return 'nil';
    } else if (ArrayBuffer.isView(o)) {
        return o;
    } else if (typeof o === 'object') {
        return 'table: ' + RuntimeInternal.findRef(o);
    } else if (typeof o === 'function') {
        return 'function: ' + RuntimeInternal.findRef(o);
    } else {
        return String(o);
    }
}


// NONFUNCTIONAL (thread)
function type(o) {
    if (o === null || o === undefined) {
        return 'nil';
    } else if (typeof o == 'number') {
        return 'number';
    } else if (ArrayBuffer.isView(o)) {
        return 'string';
    } else if (o === true || o === false) {
        return 'boolean';
    } else if (typeof o === 'object') {
        return 'table';
    } else if (typeof o === 'function') {
        return 'function';
    } else {
        return 'userdata';
    }
}


function unpack(list, i, j) {
    if (i == undefined) {
        i = 1;
    }
    if (j == undefined) {
        j = RuntimeInternal.getLength(list);
    }

    var out = [];
    for (let i2 = i; i2 < j + 1; i2++) {
        out.push(list[i2]);
    }
    return out;

    // for arrays, not objects
    /*
    return list.slice(i, j + 1);
    */
}


function xpcall(f, errhandler) {
    var out;
    try {
        out = f(...args);
    }
    catch(err) {
        if (ArrayBuffer.isView(err)) {
            return [false, errhandler(err)];
        } else {
            return [false, errhandler(err.name)];
        }
    }

    return [true, ...out];
}


// NONFUNCTIONAL (*)
function newproxy() {

}


// _G END




// coroutine START


var coroutine = {};


// NONFUNCTIONAL (*)
coroutine.create = function() {

}


// NONFUNCTIONAL (*)
coroutine.resume = function() {

}


// NONFUNCTIONAL (*)
coroutine.running = function() {

}


// NONFUNCTIONAL (*)
coroutine.status = function() {

}


// NONFUNCTIONAL (*)
coroutine.wrap = function() {

}


// NONFUNCTIONAL (*)
coroutine.yield = function() {

}


// coroutine END




// debug START


var debug = {};


// NONFUNCTIONAL (*)
debug.debug = function() {

}


// NONFUNCTIONAL (*)
debug.getfenv = function() {

}


// NONFUNCTIONAL (*)
debug.gethook = function() {

}


// NONFUNCTIONAL (*)
debug.getinfo = function() {

}


// NONFUNCTIONAL (*)
debug.getlocal = function() {

}


// NONFUNCTIONAL (*)
debug.getmetatable = function() {

}


// NONFUNCTIONAL (*)
debug.getregistry = function() {

}


// NONFUNCTIONAL (*)
debug.getupvalue = function() {

}


// NONFUNCTIONAL (*)
debug.setfenv = function() {

}


// NONFUNCTIONAL (*)
debug.sethook = function() {

}


// NONFUNCTIONAL (*)
debug.setlocal = function() {

}


// NONFUNCTIONAL (*)
debug.setmetatable = function() {

}


// NONFUNCTIONAL (*)
debug.setupvalue = function() {

}


// NONFUNCTIONAL (*)
debug.traceback = function() {

}


// debug END




// io START


if (RuntimeInternal.Mode == 'node') {


{
    // RuntimeInternal.asyncToSync = function(f) {
    //     return (...args) => {
    //         // Assumes last one is callback
    //         let cb = args[args.length - 1];
    //         let out = null;
    //         args[args.length - 1] = (...o) => {
    //             out = o;
    //         }
    //         while (!out) {

    //         }
    //         return out;
    //     }
    // }

    // NODE ONLY
    RuntimeInternal.fs = RuntimeInternal.oldRequire('fs');
    // RuntimeInternal.fsOpen = RuntimeInternal.asyncToSync(fs.open);
    // RuntimeInternal.fsRead = RuntimeInternal.asyncToSync(fs.read);
    // RuntimeInternal.fsWrite = RuntimeInternal.asyncToSync(fs.write);
    // RuntimeInternal.fsClose = RuntimeInternal.asyncToSync(fs.close);
    RuntimeInternal.fsOpen = RuntimeInternal.fs.openSync;
    RuntimeInternal.fsRead = RuntimeInternal.fs.readSync;
    RuntimeInternal.fsWrite = RuntimeInternal.fs.writeSync;
    RuntimeInternal.fsClose = RuntimeInternal.fs.closeSync;

    RuntimeInternal.fileIdentifier = {
        file: {},
        closedFile: {},
    }

    RuntimeInternal.toFile = function(f) {
        return {
            RuntimeInternal_fileIdentifier: RuntimeInternal.fileIdentifier.file,
            RuntimeInternal_filePosition: 0,
            RuntimeInternal_file: f,
            close: (file) => {
                file.RuntimeInternal_fileIdentifier = RuntimeInternal.fileIdentifier.closedFile;
                RuntimeInternal.fsClose(f);
            },
            flush: (file) => {
                // TODO: IMPLEMENT
            },
            lines: (file) => {
                // TODO: IMPLEMENT
                return [];
            },
            read: (file, ...args) => {
                let out = [];
    
                if (args.length == 0) {
                    args.push('*l');
                }
    
                for (let i = 0; i < args.length; i++) {
                    let arg = RuntimeInternal.toActualString(args[i]);
                    switch (arg.slice(0, 2)) {
                        case '*n':
                            break;
                        case '*a':
                            // RuntimeInternal.fsRead();
                            break;
                        case '*l':
                            break;
                        default:
                            if (typeof args[i] == 'number') {
                                let str = new Uint8Array(args[i]);
                                RuntimeInternal.fsRead(f)                                
                            }
                            break;
                    }
                }
    
                if (out.length == 0 || out.length == 1) {
                    return out[0];
                } else {
                    return out;
                }
            },
            seek: (file, whence, offset) => {
                let base;
                switch (whence) {
                    case 'set':
                        base = 0;
                        break;
                    case 'cur':
                        // base = file.
                        break;
                    case 'end':
                        // base = fs.statsy
                        break;
                    default:
                        break;
                }
            },
            setvbuf: (file) => {
                // TODO: IMPLEMENT
                return [];
            },
            write: (file, ...args) => {
                // TODO: Modes, double check if implemented
                // TODO: ERROR HANDLING
                let data = '';
                for (let i = 0; i < args.length; i++) {
                    data = data + RuntimeInternal.stringToActualString(args[i]);
                }

                // TODO: actual writing of data
            },
        };
    }
}

var io = {};


// NONFUNCTIONAL (*)
io.close = function() {

}


// NONFUNCTIONAL (*)
io.flush = function() {

}


io.input = function(file) {
    if (file == undefined) {
        // Do nothing
    } else if (ArrayBuffer.isView(file)) {
        var f = io.open(file, 'r');
        io.stdin = f;
    } else {
        io.stdin = f;
    }
    return io.stdin;
}


// NONFUNCTIONAL (*)
io.lines = function() {

}


io.open = function(filenameraw, moderaw) {
    // TODO: TRANSLATION OF mode TO flag
    let flag = RuntimeInternal.stringToActualString(moderaw);
    let filename = RuntimeInternal.stringToActualString(filenameraw);

    let [err, f] = RuntimeInternal.fsOpen(filename, flag);

    return RuntimeInternal.toFile(f);
}


io.output = function(file) {
    if (file == undefined) {
        // Do nothing
    } else if (ArrayBuffer.isView(file)) {
        var f = io.open(file, 'w');
        io.stdout = f;
    } else {
        io.stdout = f;
    }
    return io.stdout;
}


// NONFUNCTIONAL (*)
io.popen = function() {

}


io.read = function(...args) {
    let f = io.input();
    return f.read(f);
}


io.stderr = RuntimeInternal.toFile(process.stderr.fd);


io.stdin = RuntimeInternal.toFile(process.stdin.fd);


io.stdout = RuntimeInternal.toFile(process.stdout.fd);


// NONFUNCTIONAL (*)
io.tmpfile = function() {

}


io.type = function(obj) {
    if (obj.RuntimeInternal_fileIdentifier === RuntimeInternal.fileIdentifier.file) {
        return 'file';
    } else if (obj.RuntimeInternal_fileIdentifier === RuntimeInternal.fileIdentifier.closedFile) {
        return 'closed file';
    } else {
        return null;
    }
}


io.write = function(...args) {
    let f = io.output();
    return f.write(f);
}


// TEMP REPLACEMENT
io.write = function(...args) {
    // https://www.lua.org/pil/21.1.html
    var str = '';
    args.forEach(arg => {
        str = str + RuntimeInternal.toActualString(arg);
    });
    process.stdout.write(str);
    return [];
}


}


// io END




// math START


var math = {};


math.abs = function(x) {
    return Math.abs(x);
}


math.acos = function(x) {
    return Math.acos(x);
}


math.asin = function(x) {
    return Math.asin(x);
}


math.atan = function(x) {
    return Math.atan(x);
}


math.atan2 = function(y, x) {
    return Math.atan2(y, x);
}


math.ceil = function(x) {
    return Math.ceil(x);
}


math.cos = function(x) {
    return Math.cos(x);
}


math.cosh = function(x) {
    return Math.cosh(x);
}


math.deg = function(x) {
    return rad / (Math.PI / 180);
}


math.exp = function(x) {
    return Math.exp(x);
}


math.floor = function(x) {
    return Math.floor(x);
}


math.fmod = function(x, y) {
    return x % y;
}


math.frexp = function(arg) {
    // https://locutus.io/c/math/frexp/

    // Modified a bit
    arg = Number(arg)
    const result = [arg, 0]
    if (arg !== 0 && Number.isFinite(arg)) {
        const absArg = Math.abs(arg)
        // Math.log2 was introduced in ES2015, use it when available
        let exp = Math.max(-1023, Math.floor(Math.log2(absArg)) + 1)
        let x = absArg * Math.pow(2, -exp)
        // These while loops compensate for rounding errors that sometimes occur because of ECMAScript's Math.log2's undefined precision
        // and also works around the issue of Math.pow(2, -exp) === Infinity when exp <= -1024
        while (x < 0.5) {
            x *= 2
            exp--
        }
        while (x >= 1) {
            x *= 0.5
            exp++
        }
        if (arg < 0) {
            x = -x
        }
        result[0] = x
        result[1] = exp
    }
    return result;
}


math.huge = Number.MAX_SAFE_INTEGER;


math.ldexp = function(mantissa, exponent) {
    // https://blog.codefrau.net/2014/08/deconstructing-floats-frexp-and-ldexp.html

    var steps = Math.min(3, Math.ceil(Math.abs(exponent) / 1023));
    var result = mantissa;
    for (var i = 0; i < steps; i++)
        result *= Math.pow(2, Math.floor((exponent + i) / steps));
    return result;
}


math.log = function(x) {
    return Math.log(x);
}


math.log10 = function(x) {
    return Math.log10(x);
}


math.max = function(...args) {
    var c;
    args.forEach(arg => {
        if (c == undefined) {
            c = arg;
        } else if (arg > c) {
            c = arg;
        }
    })
    return c;
}


math.min = function(...args) {
    var c;
    args.forEach(arg => {
        if (c == undefined) {
            c = arg;
        } else if (arg < c) {
            c = arg;
        }
    })
    return c;
}


math.modf = function(x) {
    var i = Math.floor(x);
    return [i, x - i];
}


math.pi = Math.PI;


math.pow = function(x, y) {
    return Math.pow(x, y);
}


math.rad = function(deg) {
    return deg * (Math.PI / 180);
}


math.random = function(m, n) {
    if (m == undefined && n == undefined) {
        return Math.random();
    } else if (n == undefined) {
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random
        return RuntimeInternal.getRandom(1, m);
    } else {
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random
        return RuntimeInternal.getRandom(m, n);
    }
}


// NONFUNCTIONAL (*)
math.randomseed = function(x) {
    // https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript
}


math.sin = function(x) {
    return Math.sin(x);
}


math.sinh = function(x) {
    return Math.sin(x);
}


math.sqrt = function(x) {
    return Math.sqrt(x);
}


math.tan = function(x) {
    return Math.tan(x);
}


math.tanh = function(x) {
    return Math.tanh(x);
}


// math END




// os START


var os = {};


os.clock = function() {
    return (performance.now - RuntimeInternal.msSinceStart) / 1000;
}


// NONFUNCTIONAL (*), TODO
os.date = function(format, time) {
    
}


os.difftime = function(t2, t1) {
    return [t2 - t1];
}


// NONFUNCTIONAL (*), TODO
os.execute = function(command) {
    
}


os.exit = function(code) {
    if (code == undefined) {
        code = 0;
    }
    process.exit(code);
}


// NONFUNCTIONAL (*), TODO
os.getenv = function() {
    
}


// NONFUNCTIONAL (*), TODO
os.remove = function() {
    
}


// NONFUNCTIONAL (*), TODO
os.rename = function() {
    
}


// NONFUNCTIONAL (*), TODO
os.setlocale = function() {
    
}


// NONFUNCTIONAL (*), TODO
os.time = function() {
    
}


// NONFUNCTIONAL (*), TODO
os.tmpname = function() {
    
}


// os END




// package START


// NONFUNCTIONAL (*), TODO
// package is reserved


// package END




// string START


{
    RuntimeInternal.luainjs = {};
    
// lua-in-js dependency: printj
// Apache-2.0
// https://github.com/SheetJS/printj/blob/master/printj.js
// https://minify-js.com/
RuntimeInternal.luainjs.PRINTJ={};RuntimeInternal.luainjs.PRINTJ.sprintf=function(){for(var e=new Array(arguments.length-1),t=0;t<e.length;++t)e[t]=arguments[t+1];return RuntimeInternal.luainjs.PRINTJ.doit(RuntimeInternal.luainjs.PRINTJ.tokenize(arguments[0]),e)};RuntimeInternal.luainjs.PRINTJ.tcache={},RuntimeInternal.luainjs.PRINTJ.tokenize=function(e){if(RuntimeInternal.luainjs.PRINTJ.tcache[e])return RuntimeInternal.luainjs.PRINTJ.tcache[e];for(var t=[],a=0,r=0,s=!1,n="",c="",h="",i="",g="",l=0,o=e.length;r<o;++r)if(l=e.charCodeAt(r),s)if(l>=48&&l<58)i.length?i+=String.fromCharCode(l):48!=l||h.length?h+=String.fromCharCode(l):c+=String.fromCharCode(l);else switch(l){case 36:i.length?i+="$":"*"==h.charAt(0)?h+="$":(n=h+"$",h="");break;case 39:c+="'";break;case 45:c+="-";break;case 43:c+="+";break;case 32:c+=" ";break;case 35:c+="#";break;case 46:i=".";break;case 42:"."==i.charAt(0)?i+="*":h+="*";break;case 104:case 108:if(g.length>1)throw"bad length "+g+String(l);g+=String.fromCharCode(l);break;case 76:case 106:case 122:case 116:case 113:case 90:case 119:if(""!==g)throw"bad length "+g+String.fromCharCode(l);g=String.fromCharCode(l);break;case 73:if(""!==g)throw"bad length "+g+"I";g="I";break;case 100:case 105:case 111:case 117:case 120:case 88:case 102:case 70:case 101:case 69:case 103:case 71:case 97:case 65:case 99:case 67:case 115:case 83:case 112:case 110:case 68:case 85:case 79:case 109:case 98:case 66:case 121:case 89:case 74:case 86:case 84:case 37:s=!1,i.length>1&&(i=i.substr(1)),t.push([String.fromCharCode(l),e.substring(a,r+1),n,c,h,i,g]),a=r+1,g=i=h=c=n="";break;default:throw new Error("Invalid format string starting with |"+e.substring(a,r+1)+"|")}else{if(37!==l)continue;a<r&&t.push(["L",e.substring(a,r)]),a=r,s=!0}return a<e.length&&t.push(["L",e.substring(a)]),RuntimeInternal.luainjs.PRINTJ.tcache[e]=t},RuntimeInternal.luainjs.PRINTJ.u_inspect=JSON.stringify,RuntimeInternal.luainjs.PRINTJ.doit=function(e,t){for(var a="",r=0,s=0,n=0,c="",h=0;h<e.length;++h){var i=e[h],g=i[0].charCodeAt(0);if(76!==g)if(37!==g){var l="",o=0,b=10,f=4,u=!1,p=i[3],d=p.indexOf("#")>-1;if(i[2])r=parseInt(i[2],10)-1;else if(109===g&&!d){a+="Success";continue}var k=0;i[4].length>0&&(k="*"!==i[4].charAt(0)?parseInt(i[4],10):1===i[4].length?t[s++]:t[parseInt(i[4].substr(1),10)-1]);var x=-1;i[5].length>0&&(x="*"!==i[5].charAt(0)?parseInt(i[5],10):1===i[5].length?t[s++]:t[parseInt(i[5].substr(1),10)-1]),i[2]||(r=s++);var C=t[r],O=i[6];switch(g){case 83:case 115:l=String(C),x>=0&&(l=l.substr(0,x)),(k>l.length||-k>l.length)&&((-1==p.indexOf("-")||k<0)&&-1!=p.indexOf("0")?l=(c=k-l.length>=0?"0".repeat(k-l.length):"")+l:(c=k-l.length>=0?" ".repeat(k-l.length):"",l=p.indexOf("-")>-1?l+c:c+l));break;case 67:case 99:switch(typeof C){case"number":var S=C;67==g||108===O.charCodeAt(0)?(S&=4294967295,l=String.fromCharCode(S)):(S&=255,l=String.fromCharCode(S));break;case"string":l=C.charAt(0);break;default:l=String(C).charAt(0)}(k>l.length||-k>l.length)&&((-1==p.indexOf("-")||k<0)&&-1!=p.indexOf("0")?l=(c=k-l.length>=0?"0".repeat(k-l.length):"")+l:(c=k-l.length>=0?" ".repeat(k-l.length):"",l=p.indexOf("-")>-1?l+c:c+l));break;case 68:f=8;case 100:case 105:o=-1,u=!0;break;case 85:f=8;case 117:o=-1;break;case 79:f=8;case 111:o=-1,b=8;break;case 120:o=-1,b=-16;break;case 88:o=-1,b=16;break;case 66:f=8;case 98:o=-1,b=2;break;case 70:case 102:o=1;break;case 69:case 101:o=2;break;case 71:case 103:o=3;break;case 65:case 97:o=4;break;case 112:n="number"==typeof C?C:C?Number(C.l):-1,isNaN(n)&&(n=-1),l=d?n.toString(10):"0x"+(n=Math.abs(n)).toString(16).toLowerCase();break;case 110:C&&(C.len=a.length);continue;case 109:l=C instanceof Error?C.message?C.message:C.errno?"Error number "+C.errno:"Error "+String(C):"Success";break;case 74:l=(d?RuntimeInternal.luainjs.PRINTJ.u_inspect:JSON.stringify)(C);break;case 86:l=null==C?"null":String(C.valueOf());break;case 84:l=d?(l=Object.prototype.toString.call(C).substr(8)).substr(0,l.length-1):typeof C;break;case 89:case 121:l=C?d?"yes":"true":d?"no":"false",89==g&&(l=l.toUpperCase()),x>=0&&(l=l.substr(0,x)),(k>l.length||-k>l.length)&&((-1==p.indexOf("-")||k<0)&&-1!=p.indexOf("0")?l=(c=k-l.length>=0?"0".repeat(k-l.length):"")+l:(c=k-l.length>=0?" ".repeat(k-l.length):"",l=p.indexOf("-")>-1?l+c:c+l))}if(k<0&&(k=-k,p+="-"),-1==o){switch(n=Number(C),O){case"hh":f=1;break;case"h":f=2;break;case"l":case"L":case"q":case"ll":case"j":case"t":case"z":case"Z":case"I":4==f&&(f=8)}switch(f){case 1:n&=255,u&&n>127&&(n-=256);break;case 2:n&=65535,u&&n>32767&&(n-=65536);break;case 4:n=u?0|n:n>>>0;break;default:n=isNaN(n)?0:Math.round(n)}if(f>4&&n<0&&!u)if(16==b||-16==b)l=(n>>>0).toString(16),l=(16-(l=((n=Math.floor((n-(n>>>0))/Math.pow(2,32)))>>>0).toString(16)+(8-l.length>=0?"0".repeat(8-l.length):"")+l).length>=0?"f".repeat(16-l.length):"")+l,16==b&&(l=l.toUpperCase());else if(8==b)l=(10-(l=(n>>>0).toString(8)).length>=0?"0".repeat(10-l.length):"")+l,l="1"+(21-(l=(l=((n=Math.floor((n-(n>>>0&1073741823))/Math.pow(2,30)))>>>0).toString(8)+l.substr(l.length-10)).substr(l.length-20)).length>=0?"7".repeat(21-l.length):"")+l;else{n=-n%1e16;for(var A=[1,8,4,4,6,7,4,4,0,7,3,7,0,9,5,5,1,6,1,6],w=A.length-1;n>0;)(A[w]-=n%10)<0&&(A[w]+=10,A[w-1]--),--w,n=Math.floor(n/10);l=A.join("")}else l=-16===b?n.toString(16).toLowerCase():16===b?n.toString(16).toUpperCase():n.toString(b);if(0!==x||"0"!=l||8==b&&d){if(l.length<x+("-"==l.substr(0,1)?1:0)&&(l="-"!=l.substr(0,1)?(x-l.length>=0?"0".repeat(x-l.length):"")+l:l.substr(0,1)+(x+1-l.length>=0?"0".repeat(x+1-l.length):"")+l.substr(1)),!u&&d&&0!==n)switch(b){case-16:l="0x"+l;break;case 16:l="0X"+l;break;case 8:"0"!=l.charAt(0)&&(l="0"+l);break;case 2:l="0b"+l}}else l="";u&&"-"!=l.charAt(0)&&(p.indexOf("+")>-1?l="+"+l:p.indexOf(" ")>-1&&(l=" "+l)),k>0&&l.length<k&&(p.indexOf("-")>-1?l+=k-l.length>=0?" ".repeat(k-l.length):"":p.indexOf("0")>-1&&x<0&&l.length>0?(x>l.length&&(l=(x-l.length>=0?"0".repeat(x-l.length):"")+l),c=k-l.length>=0?(x>0?" ":"0").repeat(k-l.length):"",l=l.charCodeAt(0)<48?"x"==l.charAt(2).toLowerCase()?l.substr(0,3)+c+l.substring(3):l.substr(0,1)+c+l.substring(1):"x"==l.charAt(1).toLowerCase()?l.substr(0,2)+c+l.substring(2):c+l):l=(k-l.length>=0?" ".repeat(k-l.length):"")+l)}else if(o>0){n=Number(C),null===C&&(n=NaN),"L"==O&&(f=12);var N=isFinite(n);if(N){var v=0;-1==x&&4!=o&&(x=6),3==o&&(0===x&&(x=1),x>(v=+(l=n.toExponential(1)).substr(l.indexOf("e")+1))&&v>=-4?(o=11,x-=v+1):(o=12,x-=1));var I=n<0||1/n==-1/0?"-":"";switch(n<0&&(n=-n),o){case 1:case 11:if(n<1e21){l=n.toFixed(x),1==o?0===x&&d&&-1==l.indexOf(".")&&(l+="."):d?-1==l.indexOf(".")&&(l+="."):l=l.replace(/(\.\d*[1-9])0*$/,"$1").replace(/\.0*$/,"");break}v=+(l=n.toExponential(20)).substr(l.indexOf("e")+1),l=l.charAt(0)+l.substr(2,l.indexOf("e")-2),l+=v-l.length+1>=0?"0".repeat(v-l.length+1):"",(d||x>0&&11!==o)&&(l=l+"."+(x>=0?"0".repeat(x):""));break;case 2:case 12:v=(l=n.toExponential(x)).indexOf("e"),l.length-v==3&&(l=l.substr(0,v+2)+"0"+l.substr(v+2)),d&&-1==l.indexOf(".")?l=l.substr(0,v)+"."+l.substr(v):d||12!=o||(l=l.replace(/\.0*e/,"e").replace(/\.(\d*[1-9])0*e/,".$1e"));break;case 4:if(0===n){l="0x0"+(d||x>0?"."+(x>=0?"0".repeat(x):""):"")+"p+0";break}var m=(l=n.toString(16)).charCodeAt(0);if(48==m){for(m=2,v=-4,n*=16;48==l.charCodeAt(m++);)v-=4,n*=16;m=(l=n.toString(16)).charCodeAt(0)}var J=l.indexOf(".");if(l.indexOf("(")>-1){var M=l.match(/\(e(.*)\)/),P=M?+M[1]:0;v+=4*P,n/=Math.pow(16,P)}else J>1?(v+=4*(J-1),n/=Math.pow(16,J-1)):-1==J&&(v+=4*(l.length-1),n/=Math.pow(16,l.length-1));if(f>8?m<50?(v-=3,n*=8):m<52?(v-=2,n*=4):m<56&&(v-=1,n*=2):m>=56?(v+=3,n/=8):m>=52?(v+=2,n/=4):m>=50&&(v+=1,n/=2),(l=n.toString(16)).length>1){if(l.length>x+2&&l.charCodeAt(x+2)>=56){var R=102==l.charCodeAt(0);l=(n+8*Math.pow(16,-x-1)).toString(16),R&&49==l.charCodeAt(0)&&(v+=4)}x>0?(l=l.substr(0,x+2)).length<x+2&&(l.charCodeAt(0)<48?l=l.charAt(0)+(x+2-l.length>=0?"0".repeat(x+2-l.length):"")+l.substr(1):l+=x+2-l.length>=0?"0".repeat(x+2-l.length):""):0===x&&(l=l.charAt(0)+(d?".":""))}else x>0?l=l+"."+(x>=0?"0".repeat(x):""):d&&(l+=".");l="0x"+l+"p"+(v>=0?"+"+v:v)}""===I&&(p.indexOf("+")>-1?I="+":p.indexOf(" ")>-1&&(I=" ")),l=I+l}else n<0?l="-":p.indexOf("+")>-1?l="+":p.indexOf(" ")>-1&&(l=" "),l+=isNaN(n)?"nan":"inf";k>l.length&&(p.indexOf("-")>-1?l+=k-l.length>=0?" ".repeat(k-l.length):"":p.indexOf("0")>-1&&l.length>0&&N?(c=k-l.length>=0?"0".repeat(k-l.length):"",l=l.charCodeAt(0)<48?"x"==l.charAt(2).toLowerCase()?l.substr(0,3)+c+l.substring(3):l.substr(0,1)+c+l.substring(1):"x"==l.charAt(1).toLowerCase()?l.substr(0,2)+c+l.substring(2):c+l):l=(k-l.length>=0?" ".repeat(k-l.length):"")+l),g<96&&(l=l.toUpperCase())}a+=l}else a+="%";else a+=i[1]}return a};





    // string.js
    RuntimeInternal.luainjs.ROSETTA_STONE = {
        '([^a-zA-Z0-9%(])-': '$1*?',
        '([^%])-([^a-zA-Z0-9?])': '$1*?$2',
        '([^%])\\.': '$1[\\s\\S]',
        '(.)-$': '$1*?',
        '%a': '[a-zA-Z]',
        '%A': '[^a-zA-Z]',
        '%c': '[\x00-\x1f]',
        '%C': '[^\x00-\x1f]',
        '%d': '\\d',
        '%D': '[^d]',
        '%l': '[a-z]',
        '%L': '[^a-z]',
        '%p': '[.,"\'?!;:#$%&()*+-/<>=@\\[\\]\\\\^_{}|~]',
        '%P': '[^.,"\'?!;:#$%&()*+-/<>=@\\[\\]\\\\^_{}|~]',
        '%s': '[ \\t\\n\\f\\v\\r]',
        '%S': '[^ \t\n\f\v\r]',
        '%u': '[A-Z]',
        '%U': '[^A-Z]',
        '%w': '[a-zA-Z0-9]',
        '%W': '[^a-zA-Z0-9]',
        '%x': '[a-fA-F0-9]',
        '%X': '[^a-fA-F0-9]',
        '%([^a-zA-Z])': '\\$1'
    };

    // pattern should be js string
    RuntimeInternal.luainjs.translatePattern = function(pattern) {
        // TODO Add support for balanced character matching (not sure this is easily achieveable).

        // Replace single backslash with double backslashes
        let tPattern = pattern.replace(/\\/g, '\\\\')
        
        for (const [k, v] of Object.entries(RuntimeInternal.luainjs.ROSETTA_STONE)) {
            tPattern = tPattern.replace(new RegExp(k, 'g'), v)
        }

        let nestingLevel = 0

        for (let i = 0, l = tPattern.length; i < l; i++) {
            if (i && tPattern.substr(i - 1, 1) === '\\') {
                continue
            }

            // Remove nested square brackets caused by substitutions
            const character = tPattern.substr(i, 1)

            if (character === '[' || character === ']') {
                if (character === ']') {
                    nestingLevel -= 1
                }

                if (nestingLevel > 0) {
                    tPattern = tPattern.substr(0, i) + tPattern.substr(i + 1)
                    i -= 1
                    l -= 1
                }

                if (character === '[') {
                    nestingLevel += 1
                }
            }
        }

        return tPattern
    };


    // string.ts start
    
    /**
     * Looks for the first match of pattern (see §6.4.1) in the string s. If it finds a match, then find returns
     * the indices of s where this occurrence starts and ends; otherwise, it returns nil.
     * A third, optional numeric argument init specifies where to start the search; its default value is 1 and can be negative.
     * A value of true as a fourth, optional argument plain turns off the pattern matching facilities,
     * so the function does a plain "find substring" operation, with no characters in pattern being considered magic.
     * Note that if plain is given, then init must be given as well.
     *
     * If the pattern has captures, then in a successful match the captured values are also returned, after the two indices.
     */
    RuntimeInternal.luainjs.find = function(s, pattern, init, plain) {
        // const S = coerceArgToString(s, 'find', 1)
        // const P = coerceArgToString(pattern, 'find', 2)
        const S = RuntimeInternal.stringToActualString(s);
        const P = RuntimeInternal.stringToActualString(pattern);
        const INIT = init === undefined ? 1 : init;
        const PLAIN = plain === undefined ? false : plain;

        // Regex
        if (!PLAIN) {
            const regex = new RegExp(RuntimeInternal.luainjs.translatePattern(P))
            const index = S.substr(INIT - 1).search(regex)

            if (index < 0) return []

            const match = S.substr(INIT - 1).match(regex)
            const result = [index + INIT, index + INIT + match[0].length - 1]

            match.shift()
            return [...result, ...match]
        }

        // Plain
        const index = S.indexOf(P, INIT - 1)
        return index === -1 ? [] : [index + 1, index + P.length]
    };

    RuntimeInternal.luainjs.format = function(formatstring1, ...args) {
        let formatstring = RuntimeInternal.stringToActualString(formatstring1)
        // Pattern with all constraints:
        // /%%|%([-+ #0]{0,5})?(\d{0,2})?(?:\.(\d{0,2}))?([AEGXacdefgioqsux])/g
        const PATTERN = /%%|%([-+ #0]*)?(\d*)?(?:\.(\d*))?(.)/g

        let i = -1
        return formatstring.replace(PATTERN, (format, flags, width, precision, modifier) => {
            if (format === '%%') return '%'
            if (!modifier.match(/[AEGXacdefgioqsux]/)) {
                throw new LuaError(`invalid option '%${format}' to 'format'`)
            }
            if (flags && flags.length > 5) {
                throw new LuaError(`invalid format (repeated flags)`)
            }
            if (width && width.length > 2) {
                throw new LuaError(`invalid format (width too long)`)
            }
            if (precision && precision.length > 2) {
                throw new LuaError(`invalid format (precision too long)`)
            }

            i += 1
            const arg = args[i]
            if (arg === undefined) {
                throw new LuaError(`bad argument #${i} to 'format' (no value)`)
            }
            if (/A|a|E|e|f|G|g/.test(modifier)) {
                // return RuntimeInternal.luainjs.PRINTJ.sprintf(format, coerceArgToNumber(arg, 'format', i))
                return RuntimeInternal.luainjs.PRINTJ.sprintf(format, arg);
            }
            if (/c|d|i|o|u|X|x/.test(modifier)) {
                // return RuntimeInternal.luainjs.PRINTJ.sprintf(format, coerceArgToNumber(arg, 'format', i))
                return RuntimeInternal.luainjs.PRINTJ.sprintf(format, arg);
            }

            if (modifier === 'q') {
                return `"${(RuntimeInternal.toActualString(arg)).replace(/([\n"])/g, '\\$1')}"`
            }
            if (modifier === 's') {
                return RuntimeInternal.luainjs.PRINTJ.sprintf(format, RuntimeInternal.toActualString(tostring(arg)))
            }
            return RuntimeInternal.luainjs.PRINTJ.sprintf(format, arg) // maybe add modifier here? (RuntimeInternal.toActualString())
        })
    };

    /**
     * Returns an iterator function that, each time it is called, returns the next captures from pattern (see §6.4.1)
     * over the string s. If pattern specifies no captures, then the whole match is produced in each call.
     */
    RuntimeInternal.luainjs.gmatch = function(s, pattern) {
        // const S = coerceArgToString(s, 'gmatch', 1)
        // const P = RuntimeInternal.luainjs.translatePattern(coerceArgToString(pattern, 'gmatch', 2))
        const S = RuntimeInternal.stringToActualString(s);
        const P = RuntimeInternal.luainjs.translatePattern(RuntimeInternal.stringToActualString(pattern));

        const reg = new RegExp(P, 'g')
        const matches = S.match(reg)

        return () => {
            const match = matches.shift()
            if (match === undefined) return []

            const groups = new RegExp(P).exec(match)
            groups.shift()
            return groups.length ? groups : [match]
        }
    };

    /**
     * Returns a copy of s in which all (or the first n, if given) occurrences of the pattern (see §6.4.1)
     * have been replaced by a replacement string specified by repl, which can be a string, a table, or a function.
     * gsub also returns, as its second value, the total number of matches that occurred.
     * The name gsub comes from Global SUBstitution.
     *
     * If repl is a string, then its value is used for replacement. The character % works as an escape character:
     * any sequence in repl of the form %d, with d between 1 and 9, stands for the value of the d-th captured substring.
     * The sequence %0 stands for the whole match. The sequence %% stands for a single %.
     *
     * If repl is a table, then the table is queried for every match, using the first capture as the key.
     *
     * If repl is a function, then this function is called every time a match occurs,
     * with all captured substrings passed as arguments, in order.
     *
     * In any case, if the pattern specifies no captures, then it behaves as if the whole pattern was inside a capture.
     *
     * If the value returned by the table query or by the function call is a string or a number,
     * then it is used as the replacement string; otherwise, if it is false or nil, then there is no replacement
     * (that is, the original match is kept in the string).
     */
    RuntimeInternal.luainjs.gsub = function(s, pattern, repl, n) {
        // let S = coerceArgToString(s, 'gsub', 1)
        let S = RuntimeInternal.stringToActualString(s);
        // const N = n === undefined ? Infinity : coerceArgToNumber(n, 'gsub', 3)
        const N = n === undefined ? Infinity : n;
        // const P = RuntimeInternal.luainjs.translatePattern(coerceArgToString(pattern, 'gsub', 2))
        const P = RuntimeInternal.luainjs.translatePattern(RuntimeInternal.stringToActualString(pattern));

        const REPL = (() => {
            if (typeof repl === 'function')
                return strs => {
                    const ret = repl(strs[0])[0]
                    return ret === undefined ? strs[0] : ret
                }

            if (repl instanceof Table) return strs => repl.get(strs[0]).toString()

            return strs => `${repl}`.replace(/%([0-9])/g, (_, i) => strs[i])
        })()

        let result = ''
        let count = 0
        let match
        let lastMatch
        while (count < N && S && (match = S.match(P))) {
            const prefix =
                // eslint-disable-next-line no-nested-ternary
                match[0].length > 0 ? S.substr(0, match.index) : lastMatch === undefined ? '' : S.substr(0, 1)

            lastMatch = match[0]
            result += `${prefix}${REPL(match)}`
            S = S.substr(`${prefix}${lastMatch}`.length)

            count += 1
        }

        return `${result}${S}`
    };

    // ...

    /**
     * Looks for the first match of pattern (see §6.4.1) in the string s.
     * If it finds one, then match returns the captures from the pattern; otherwise it returns nil.
     * If pattern specifies no captures, then the whole match is returned.
     * A third, optional numeric argument init specifies where to start the search; its default value is 1 and can be negative.
     */
    RuntimeInternal.luainjs.match = function(s, pattern, init) {
        // let str = coerceArgToString(s, 'match', 1)
        let str = RuntimeInternal.stringToActualString(s);
        // const patt = coerceArgToString(pattern, 'match', 2)
        const patt = RuntimeInternal.stringToActualString(pattern);
        // const ini = coerceArgToNumber(init, 'match', 3)
        const ini = init == undefined ? 0 : init;

        str = str.substr(ini)
        const matches = str.match(new RegExp(translatePattern(patt)))

        if (!matches) {
            return
        } else if (!matches[1]) {
            return matches[0]
        }

        matches.shift()
        return matches
    };



    // string.lower, string.upper
    /*
    runtime_genstringmappings.lua
    */
    RuntimeInternal.lowerMap = {65:97,66:98,67:99,68:100,69:101,70:102,71:103,72:104,73:105,74:106,75:107,76:108,77:109,78:110,79:111,80:112,81:113,82:114,83:115,84:116,85:117,86:118,87:119,88:120,89:121,90:122};
    RuntimeInternal.upperMap = {97:65,98:66,99:67,100:68,101:69,102:70,103:71,104:72,105:73,106:74,107:75,108:76,109:77,110:78,111:79,112:80,113:81,114:82,115:83,116:84,117:85,118:86,119:87,120:88,121:89,122:90};
}

var string = {};


string.byte = function(s, i, j) {
    if (i == undefined) {
        i = 1;
    }
    if (j == undefined) {
        j = i;
    }

    var out = [];

    for (let i2 = i - 1; i2 < j; i2++) {
        out.push(s[i2]);
    }

    return out; // TODO: One return ambiguous?
}


string.char = function(...args) {
    return new Uint8Array(args);
}


// NONFUNCTIONAL (*), TODO
string.dump = function() {
    
}


string.find = RuntimeInternal.luainjs.find;


string.format = RuntimeInternal.luainjs.format;


string.gmatch = RuntimeInternal.luainjs.gmatch;


string.gsub = RuntimeInternal.luainjs.gsub;


string.len = function(str) {
    return str.length;
}


string.lower = function(str) {
    let out = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
        let s = RuntimeInternal.lowerMap[str[i]];
        out[i] = s == undefined ? str[i] : s;
    }
    return out;
}


string.match = RuntimeInternal.luainjs.match;


string.rep = function(s, n) {
    let out = new Uint8Array(s.length * n);
    for (let i = 0; i < n; i++) {
        out.set(s, i * s.length);
    }
    return out;
}


string.reverse = function(str) {
    var out = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
        out[i] = str[str.length - i - 1];
    }
    return out;
}


string.sub = function(str, i, j) {
    if (j == undefined) {
        j = -1;
    }
    if (i < 0) {
        i = str.length + 1 + i;
    }
    if (j < 0) {
        j = str.length + 1 + j;
    }

    var out = new Uint8Array(j - i + 1);
    for (let i2 = i - 1; i2 < j; i2++) {
        out[i2 - i + 1] = str[i2];
    }
    return out;
}


string.upper = function(str) {
    let out = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
        let s = RuntimeInternal.upperMap[str[i]];
        out[i] = s == undefined ? str[i] : s;
    }
    return out;
}

{
    // Prototype
    for (const [key, value] of Object.entries(string)) {
        Uint8Array.prototype[key] = value;
    }
}

// {
//     // test
//     console.log(RuntimeInternal.stringToActualString(string.upper(string.lower(RuntimeInternal.actualStringToString('AMOGUS'))))); // -> 'AMOGUS'
//     console.log(RuntimeInternal.stringToActualString(string.rep(RuntimeInternal.actualStringToString('sus'), 3))); // -> 'sussussus'
// }


// string END




// table START


var table = {};


table.concat = function(t, sep, i, j) {
    t = RuntimeInternal.coerceToArray(t);
    
    if (sep == undefined) {
        sep = '';
    }
    if (i == undefined) {
        i = 1;
    }
    if (j == undefined) {
        j = RuntimeInternal.getLength(t);
    }

    if (i > j) {
        return '';
    }

    // var a = [];
    // for (let i2 = i; i2 < j + 1; i2++) {
    //     a.push(t[i2]);
    // }

    return t.slice(i, j + 1).join(sep);
}


table.insert = function(t, pos, value) {
    if (value == undefined) {
        value = pos;
        pos = RuntimeInternal.getLength(t) + 1;
    }

    for (let i = (RuntimeInternal.getLength(t)) + 1; i > pos - 1; i--) {
        if (i == pos) {
            t[i] = value;
        } else {
            t[i] = t[i - 1];
        }
    }
}


table.maxn = function(t) {
    t = RuntimeInternal.coerceToArray(t);
    
    var a = t.length
    if (a) {
        return a - 1 + 1;
    } else {
        return 0;
    }
}


table.remove = function(t, pos) {
    if (pos == undefined) {
        pos = RuntimeInternal.getLength(t);
    }

    for (let i = pos; i < RuntimeInternal.getLength(t) + 1; i++) {
        if (i == RuntimeInternal.getLength(t)) {
            t.pop();
        } else {
            t[i] = t[i + 1];
        }
    }
}


table.sort = function(t, comp) {
    if (comp == undefined) {
        comp = RuntimeInternal.defaultSortComparisonf
    }
    t.sort(comp);
}


// table END











// runtime.js END

























rt = '// Runtime is nonexistant and will never be implemented, since this project aims to transpile but not directly run the lua code in python. The objective is to write python code in lua.\n\n\n'





var get,document,window;get=function(id){return document.getElementById(id);};window.onload=function(){get(new Uint8Array([108,117,97])).oninput=function(event){

try {    

get(new Uint8Array([106,115])).value=window.luatojs(get(new Uint8Array([108,117,97])).value);

get('jsTotal').value=rt + window.luatojs(get(new Uint8Array([108,117,97])).value);
} catch (error) {
    get('js').value = error;
}

};};

amogus = function() {
    console.log(2)
    let selected = get('demo').value;
    if (selected != 'none') {
        let c;
        if (selected == 'donut') {
            c = `--https://gist.github.com/binji/dba959e5e94a5cee5ecc
-- See original here http://www.a1k0n.net/2006/09/15/obfuscated-c-donut.html

            A=0 B=0 z={}b=
         {}E={32,46,44,45,126,
       58,59,61,33,42,35,36,64}S
     =math.sin C=math.cos F=math.
  floor I=io.write T=string.char W=60
  P=print H=25 P("\\x1b[2J")for w=1,240
 do for o=0,W*H do b[o]=1 z[o]=0 end e=
 S(A)g=C(A)m=C(B)n=S(B)for j=0,6.28,.09
 do d=C(j)f=S(j)       for i=0,6.28,.04
do c=S(i)h=d+2 D        =1/(c*h*e+f*g+5)
l=C(i)t=c*h*g-            f*e x=F(W/2+W*
.3*D*(l*h*m-t*n          ))y=F(H/2+H*.6*
 D*(l*h*n+t*m))o        =x+W*y  N=math.
 max(0,F(8*((f*e-c*d*g)*m-c*d*e-f*g -l*
 d *n)))+2 if H> y and y>0 and x>0 and
  W>x and D> z[o] then  z[o]=D b[o]=N
   end end  end P( "\\x1b[H")for k=0
     ,W* H do if k%W~=0 then I(T(
       E[b[k]]))else I( T( 10))
         end end A = A + .04
             B=B+.02 end`
        }


        get('lua').value = c;


        try {    

get(new Uint8Array([106,115])).value=window.luatojs(c);

get('jsTotal').value=rt + window.luatojs(c);
} catch (error) {
    get('js').value = error;
}
    }
}

get('demo').value = 'donut';
amogus();
get('demo').onchange = amogus;

// get('run').onclick=()=>{
//     eval(get('jsTotal').value);
// }
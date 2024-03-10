/*
Converts lua to js

TODO:
Standard library

Comments, whitespace after lastnode

Typedarrays for strings?

Metatables: Proxy, Reflect or (compile?)

GetFirstValue

JS Interop (calling js functions and using js types from lua)

Figure out using unpack like f(unpack(t))
- use f.apply? spread syntax?

Frontend:
    Mappings for each character
    AST Displayer
    Input box, live output
*/

var parser = luaparse;


// var parser = require('luaparse');



// // https://www.geeksforgeeks.org/node-js-fs-readfilesync-method/
// const fs = require('fs');
// var infile = './in.lua';
// // infile = './tests/donut/in_f.lua';
// var outfile = './out.js';

// // frontend test compile
// infile = './frontend_test/script.lua';
// outfile = './frontend_test/script.js';


// var runtimefile = './runtime.js'
// // var runtimefile = './runtime_min.js'
// var CODE = fs.readFileSync(infile, {encoding: 'utf8', flag: 'r'});




window.luatojs = function(CODE) {

let fmap = {
    'io.write': 'lambda x: print(x, end="")',
    'string.char': 'chr',
    'string.byte': 'ord',
    'math.max': 'max',
}
let lmap = {
    'math': 'import math\n',
}
let runtimeNeedRangeDecimal = false;
let memberExpression = false;



var options = {
    scope: true,
    // locations: true,
    ranges: true,
    luaVersion: 'LuaJIT',
};

// 1. Generate AST
var ast = parser.parse(CODE, options);
// console.log(JSON.stringify(ast, null, 2));


// 2. Generate a list of all comments
var comments = [];
function r(node) {
    for (let k in node) {
        let v = node[k];
        if (typeof v == 'object' && v != null) {
            if (v.type == 'Comment') {
                comments.push(v);
            }
            r(v);
        }
    }
}
r(ast);


// 3. AST to JS
var out = '';


// 3.1. Declare all globals at the top
let definedGlobals = []; // Exclude already defined globals
function listGlobals() {
    return Object.getOwnPropertyNames(this);
}
let g = listGlobals()
for (let i = 0; i < g.length; i++) {
    definedGlobals.push(g[i]);
}
let definedGlobalsMap = {};
for (let i = 0; i < definedGlobals.length; i++) {
    definedGlobalsMap[definedGlobals[i]] = true;
}

if (ast.globals.length != 0) {
    let before = '';

    let empty = true;

    let out2 = '';
    // out += 'var ';
    for (let i = 0; i < ast.globals.length; i++) {
        let c = ast.globals[i];
        if (!definedGlobalsMap[c.name]) {
            if (empty) {
                out2 += 'global ';
                empty = false;
            }
            // out += c.name + '=' + c.name + '?' + c.name + ':undefined';
            if (lmap[c.name]) {
                before += lmap[c.name];
            } else {
               out2 += c.name;
                if (i != ast.globals.length - 1) {
                    out2 += ', ';
                }
            }
        }
    }
    if (!empty) {
        out2 += '\n'
    }

    out += before + out2;
}


// 3.2. Recurse on AST
var lastNode;
var localsUsed;
var indentn = 0;
var indentBase = '    ';
function indent(n) {
    return indentBase.repeat(n ? n : indentn);
}
function recurse(node, isList) {
    // scopeIndex++;
    // scopes.push(structuredClone(scopes[scopes.length - 1]));
    if (isList) {
        for (let i = 0; i < node.length; i++) {
            recurse(node[i]);
        }
    } else {
        let lastLastNode = lastNode; // last node from current node

        lastNode = node; // setting last node to current node

        switch (node.type) {
            case 'LabelStatement':
                console.log('ERROR: TODO');
                break;
            case 'BreakStatement':
                out += indent() + 'break\n';
                break;
            case 'GotoStatement':
                console.log('ERROR: TODO');
                break;
            case 'ReturnStatement':
                out += indent();
                if (node.arguments.length == 0) {
                    out += 'return\n';
                } else {
                    if (node.arguments.length == 1) {
                        out += 'return ';
                        recurse(node.arguments[0]);
                    } else {
                        out += 'return '
                        for (let i = 0; i < node.arguments.length; i++) {
                            recurse(node.arguments[i]);
                            if (i != node.arguments.length - 1) {
                                out += ', ';
                            }
                        }
                    }
                    out += '\n';
                }
                break;
            case 'IfStatement':
                recurse(node.clauses, true);
                break;
            case 'IfClause':
                out += indent() + 'if ';
                recurse(node.condition);
                out += ':\n';
                indentn++;
                recurse(node.body, true);
                indentn--;
                break;
            case 'ElseifClause':
                out += indent() + 'elif ';
                recurse(node.condition);
                out += ':\n';
                indentn++;
                recurse(node.body, true);
                indentn--;
                break;
            case 'ElseClause':
                out += indent() + 'else:\n';
                indentn++;
                recurse(node.body, true);
                indentn--;
                break;
            case 'WhileStatement':
                out += indent() + 'while ';
                recurse(node.condition);
                out += ':\n';
                indentn++;
                recurse(node.body, true);
                indentn--;
                break;
            case 'DoStatement':
                //PYFIX
                out += indent() + 'if True:\n';
                indentn++;
                recurse(node.body, true);
                indentn--;
                break;
            case 'RepeatStatement':
                out += indent() + 'while True:\n';
                indentn++;
                recurse(node.body, true);
                out += indent() + 'if '; 
                recurse(node.condition);
                out += ':\n';
                indentn++;
                out += indent() + 'break\n';
                indentn--;
                indentn--;
                break;
            case 'LocalStatement':
                out += indent();
                for (let i = 0; i < node.variables.length; i++) {
                    recurse(node.variables[i]);
                    if (i != node.variables.length - 1) {
                        out += ', ';
                    }
                }
                out += ' = ';
                let l = Math.min(node.variables.length, node.init.length);
                for (let i = 0; i < l; i++) {
                    recurse(node.init[i]);
                    if (i != l - 1) {
                        out += ', ';
                    }
                }
                out += '\n';
                break;
            case 'AssignmentStatement':
                out += indent();
                for (let i = 0; i < node.variables.length; i++) {
                    recurse(node.variables[i]);
                    if (i != node.variables.length - 1) {
                        out += ', ';
                    }
                }
                out += ' = ';
                let l2 = Math.min(node.variables.length, node.init.length);
                for (let i = 0; i < l2; i++) {
                    recurse(node.init[i]);
                    if (i != l2 - 1) {
                        out += ', ';
                    }
                }
                out += '\n';
                break;
            case 'CallStatement':
                out += indent();
                recurse(node.expression);
                out += '\n';
                break;
            case 'FunctionDeclaration':
                out += indent();
                console.log(node.identifier) // TODO: RENAME IDENTIFIER
                out += 'def '
                recurse(node.identifier);
                out += '(';
                for (let i = 0; i < node.parameters.length; i++) {
                    let c = node.parameters[i];
                    recurse(c);
                    if (i != node.parameters.length - 1) {
                        out += ',';
                    }
                }
                out += '):\n';
                indentn++;
                recurse(node.body, true);
                indentn--;
                break;
            case 'ForNumericStatement':
                out += indent();
                out += 'for ';
                recurse(node.variable);
                out += ' in range_decimal(';
                runtimeNeedRangeDecimal = true;
                recurse(node.start);
                out += ', ';
                recurse(node.end);
                out += ' + 1';
                if (node.step != null) {
                    out += ', ';
                    recurse(node.step);
                }
                out += '):\n';
                indentn++;
                recurse(node.body, true);
                indentn--;
                break;
            case 'ForGenericStatement':
                out += indent();
                // TODO
                // Heuristic
                let iterator = node.iterators[0];
                if (node.iterators.length == 1 && iterator.type == 'CallExpression' && iterator.base.name == 'pairs') {
                    out += 'for ';
                    for (let i = 0; i < node.variables.length; i++) {
                        recurse(node.variables[i]);
                        if (i != node.variables.length - 1) {
                            out += ', ';
                        }
                    }
                    out += ' in ';
                    recurse(iterator.arguments[0]);
                    out += '.items():\n';
                    indentn++;
                    recurse(node.body, true);
                    indentn--;
                } else {
                    out += '# ForGenericStatement\n';
                }

                break;
            case 'Chunk':
                localsUsed = {};
                recurse(node.body, true);
                break;
            case 'Identifier':
                if (fmap[node.name]) {
                    out += fmap[node.name];
                } else {
                    out += node.name;
                }
                break;
            case 'StringLiteral':
                let s = node.raw;

                // Old: Using normal JS strings
                if (s[0] == '\'' || s[0] == '\"') {
                    // Normal string
                    out += s;
                } else {
                    // Long string
                    let i = 1;
                    while (true) {
                        if (s[i] == '[') {
                            break;
                        }
                        i++;
                    }
                    out += '\'\'\'' + s.substring(i + 1, s.length - i - 1).replaceAll('`', '\\`') + '\'\'\''
                }

                break;
            case 'NumericLiteral':
                out += node.value;
                break;
            case 'BooleanLiteral':
                out += node.value === true ? 'True' : 'False';
                break;
            case 'NilLiteral':
                out += 'None';
                break;
            case 'VarargLiteral':
                if (lastLastNode.type == 'LogicalExpression' || lastLastNode.type == 'BinaryExpression' || lastLastNode.type == 'UnaryExpression' || lastLastNode.type == 'TableKey' || lastLastNode.type == 'TableKeyString') {
                    out += 'RuntimeInternal_VARARG[0]';
                } else if (lastLastNode.type == 'LocalStatement' || lastLastNode.type == 'AssignmentStatement') {
                    out += 'RuntimeInternal_VARARG';
                } else if (lastLastNode.type == 'TableValue') {
                    out += 'RuntimeInternal_VARARG';
                } else {
                    out += '...RuntimeInternal_VARARG';
                }
                break;
            case 'TableKey':
                out += '[';
                recurse(node.key);
                out += ']: ';
                recurse(node.value);
                break;
            case 'TableKeyString':
                out += '[\'';
                recurse(node.key);
                out += '\']: ';
                recurse(node.value);
                break;
            case 'TableValue':
                recurse(node.value);
                break;
            case 'TableConstructorExpression':
                let out2 = out;
                out = '';

                out += '{';
                let i2 = 1; // Counter for TableValue
                let trailingVararg = false;
                for (let i = 0; i < node.fields.length; i++) {
                    let c = node.fields[i];
                    // if (c.value.type == 'VarargLiteral') {
                    //     switch (c.type) {
                    //         case 'TableKey':
                    //             out += '[';
                    //             recurse(c.key);
                    //             out += ']:';
                    //             out += 'RuntimeInternal_VARARG[0]';
                    //             break;
                    //         case 'TableKeyString':
                    //             out += '[\'';
                    //             recurse(c.key);
                    //             out += '\']:';
                    //             out += 'RuntimeInternal_VARARG[0]';
                    //             break;
                    //         case 'TableValue':
                    //             out += '...RuntimeInternal_VARARG'
                    //             break;
                    //         default:
                    //             break;
                    //     }
                    // } else {
                        if (c.type == 'TableValue') {
                            if (c.value.type == 'VarargLiteral' && i == node.fields.length - 1) {
                                // out += i2 + ':';
                                // out += ''
                                trailingVararg = c;
                                i2++;
                            } else {
                                out += i2 + ': ';
                                recurse(c);
                                if (c.value.type == 'VarargLiteral') {
                                    out += '[0]';
                                }
                                i2++;
                            }
                        } else {
                            recurse(c);
                        }
                        
                    // }
                    if (i != node.fields.length - 1 & !(i == node.fields.length - 2 && node.fields[i + 1].value.type == 'VarargLiteral')) {
                        out += ', ';
                    }
                }
                out += '}';

                if (trailingVararg) {
                    out = out2 + 'RuntimeInternal.addVararg(' + out + ', ';
                    recurse(trailingVararg);
                    out += ', ' + (i2 - 1) + ')';
                } else {
                    out = out2 + out;
                }
                

                break;
            case 'LogicalExpression':
                recurse(node.left);
                switch (node.operator) {
                    case 'and':
                        out += ' and ';
                        break;
                    case 'or':
                        out += ' or ';
                        break;
                }
                recurse(node.right);
                break;
            case 'BinaryExpression':
                out += '(';
                switch (node.operator) {
                    case '..':
                        recurse(node.left);
                        out += ' + ';
                        recurse(node.right);
                        break;
                    case '==':
                        recurse(node.left);
                        out += ' == ';
                        recurse(node.right);
                        break;
                    case '>>':
                        recurse(node.left);
                        out += ' >> ';
                        recurse(node.right);
                        break;
                    case '>=':
                        recurse(node.left);
                        out += ' >= ';
                        recurse(node.right);
                        break;
                    case '>':
                        recurse(node.left);
                        out += ' > ';
                        recurse(node.right);
                        break;
                    case '<=':
                        recurse(node.left);
                        out += ' <= ';
                        recurse(node.right);
                        break;
                    case '<':
                        recurse(node.left);
                        out += ' < ';
                        recurse(node.right);
                        break;
                    case '~=':
                        recurse(node.left);
                        out += ' != ';
                        recurse(node.right);
                        break;
                    case '~':
                        recurse(node.left);
                        out += ' ^ ';
                        recurse(node.right);
                        break;
                    case '//':
                        recurse(node.left);
                        out += ' // ';
                        recurse(node.right);
                        break;
                    case '/':
                        recurse(node.left);
                        out += ' / ';
                        recurse(node.right);
                        break;
                    case '*':
                        recurse(node.left);
                        out += ' * ';
                        recurse(node.right);
                        break;
                    case '^':
                        recurse(node.left);
                        out += ' ** ';
                        recurse(node.right);
                        break;
                    case '%':
                        recurse(node.left);
                        out += ' % ';
                        recurse(node.right);
                        break;
                    case '-':
                        recurse(node.left);
                        out += ' - ';
                        recurse(node.right);
                        break;
                    case '+':
                        recurse(node.left);
                        out += ' + ';
                        recurse(node.right);
                        break;
                    default:
                        break;
                }
                out += ')';
                break;
            case 'UnaryExpression':
                switch (node.operator) {
                    case '#':
                        out += 'len('
                        recurse(node.argument);
                        out += ')'
                        break;
                    case '-':
                        // Add parenthesis in case of exponentiation
                        out += '(';
                        out += '-';
                        recurse(node.argument);
                        out += ')';
                        break;
                    case '~':
                        out += '~';
                        recurse(node.argument);
                        break;
                    case 'not':
                        out += 'not ';
                        recurse(node.argument);
                        break;
                    default:
                        break;
                }
                break;
            case 'MemberExpression':
                let lastMemberExpression = memberExpression;
                let out3;
                if (!memberExpression) {
                    memberExpression = true;
                    out3 = out;
                    out = '';
                }
                recurse(node.base);
                out += '.';
                recurse(node.identifier);
                if (lastMemberExpression == false) {
                    memberExpression = false;
                    if (fmap[out]) {
                        out = out3 + fmap[out];
                    } else {
                        out = out3 + out;
                    }
                }
                break;
            case 'IndexExpression':
                recurse(node.base);
                out += '[';
                recurse(node.index);
                out += ']';
                break;
            case 'CallExpression':
                recurse(node.base);
                out += '(';
                if (node.base.indexer == ':') {
                    recurse(node.base.base);
                    if (node.arguments.length > 0) {
                        out += ', ';
                    }
                }
                for (let i = 0; i < node.arguments.length; i++) {
                    recurse(node.arguments[i]);
                    if (i != node.arguments.length - 1) {
                        out += ', ';
                    }
                }
                out += ')';
                break;
            case 'TableCallExpression':
                recurse(node.base);
                out += '(';
                for (let i = 0; i < node.arguments.length; i++) {
                    recurse(node.arguments[i]);
                    if (i != node.arguments.length - 1) {
                        out += ', ';
                    }
                }
                out += ')';
                break;
            case 'StringCallExpression':
                recurse(node.base);
                out += '(';
                recurse(node.argument);
                // for (let i = 0; i < node.arguments.length; i++) {
                //     recurse(node.arguments[i]);
                //     if (i != node.arguments.length - 1) {
                //         out += ',';
                //     }
                // }
                out += ')';
                break;
            case 'Comment':
                out += '\'\'\'' + node.value + '\'\'\'';
                break;

            default:
                console.error('ERROR: INVALID NODE');
                break;
                
        }
    }
    // scopes.pop();
}
recurse(ast);

// 4. Serialize all remaining comments
/*
for (let i = 0; i < comments.length; i++) {
    recurse(comments[i]);
}
// */





// console.log(out);

// var runtime = fs.readFileSync(runtimefile, {encoding: 'utf8', flag: 'r'});
// var runtime = ''
// out = runtime + out;

if (runtimeNeedRangeDecimal) {
/*
    out = `
import decimal

def range_decimal(start, stop, step=1, stop_inclusive=False):
    """ The Python range_decimal() function, using decimals.  A decimal loop_value generator.

    Note: The decimal math (addition) defines the rounding.

    If the stop is None, then:
        stop = start
        start = 0 (zero)

    If the step is 0 (zero) or None, then:
        if (stop < start) then step = -1 (minus one)
        if (stop >= start) then step = 1 (one)

    Example:
        for index in range_decimal(0, 1.0, '.1', stop_inclusive=True):
            print(index)

    :param start: The loop start value
    :param stop: The loop stop value
    :param step: The loop step value
    :param stop_inclusive: Include the stop value in the loop's yield generator: False = excluded ; True = included
    :return: The loop generator's yield increment value (decimal)
    """
    try:
        # Input argument(s) error check
        zero = decimal.Decimal('0')

        if start is None:
            start = zero

        if not isinstance(start, decimal.Decimal):
            start = decimal.Decimal(f'{start}')

        if stop is None:
            stop = start
            start = zero

        if not isinstance(stop, decimal.Decimal):
            stop = decimal.Decimal(f'{stop}')

        if step is None:
            step = decimal.Decimal('-1' if stop < start else '1')

        if not isinstance(step, decimal.Decimal):
            step = decimal.Decimal(f'{step}')

        if step == zero:
            step = decimal.Decimal('-1' if stop < start else '1')

        # Check for valid loop conditions
        if start == stop or (start < stop and step < zero) or (start > stop and step > zero):
            return  # Not valid: no loop

        # Case: increment step ( > 0 )
        if step > zero:
            while start < stop:  # Yield the decimal loop points (stop value excluded)
                yield start
                start += step

        # Case: decrement step ( < 0 )
        else:
            while start > stop:  # Yield the decimal loop points (stop value excluded)
                yield start
                start += step

        # Yield the stop value (inclusive)
        if stop_inclusive:
            yield stop

    except (ValueError, decimal.DecimalException) as ex:
        raise ValueError(f'{__name__}.range_decimal() error: {ex}')


` + out;
*/


    out = `
import decimal
def range_decimal(start,stop,step=1,stop_inclusive=False):
	G=None;C=step;B=stop;A=start
	try:
		E=decimal.Decimal('0')
		if A is G:A=E
		if not isinstance(A,decimal.Decimal):A=decimal.Decimal(f"{A}")
		if B is G:B=A;A=E
		if not isinstance(B,decimal.Decimal):B=decimal.Decimal(f"{B}")
		if C is G:C=decimal.Decimal('-1'if B<A else'1')
		if not isinstance(C,decimal.Decimal):C=decimal.Decimal(f"{C}")
		if C==E:C=decimal.Decimal('-1'if B<A else'1')
		if A==B or A<B and C<E or A>B and C>E:return
		if C>E:
			while A<B:yield A;A+=C
		else:
			while A>B:yield A;A+=C
		if stop_inclusive:yield B
	except(ValueError,decimal.DecimalException)as I:raise ValueError(f"{__name__}.range_decimal() error: {I}")
` + out;
}

// fs.writeFileSync(outfile, out, {encoding: 'utf8', flag: 'w'});


return out;


// console.log(out);

// var runtime = fs.readFileSync(runtimefile, {encoding: 'utf8', flag: 'r'});
// out = runtime + out;

}
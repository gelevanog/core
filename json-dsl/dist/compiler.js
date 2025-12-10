"use strict";
/**
 * JSON DSL Compiler - компилирует JSON-конфигурации в реальные JS-функции
 *
 * Формат функций: { type: "FUNCTION", config: { debug?: boolean, ...params } }
 * Внутренние выражения и statements — упрощённый формат с полными названиями свойств
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonDslCompiler = void 0;
class JsonDslCompiler {
    constructor() {
        this.functionDefs = new Map();
        this.compiledFunctions = new Map();
        this.debugMode = false;
        this.builtins = this.createBuiltins();
        this.allowedMethods = new Set([
            'length', 'push', 'pop', 'shift', 'unshift', 'slice', 'concat',
            'indexOf', 'includes', 'find', 'filter', 'map', 'reduce',
            'join', 'split', 'trim', 'toLowerCase', 'toUpperCase',
            'substring', 'charAt', 'startsWith', 'endsWith',
            'keys', 'values', 'entries', 'hasOwnProperty',
            'toString', 'toFixed',
        ]);
    }
    /**
     * Загрузка конфигурации из JSON
     */
    load(config) {
        if (!config || !config.functions) {
            throw new Error('Invalid config: missing "functions" property');
        }
        for (const [name, def] of Object.entries(config.functions)) {
            this.validateFunction(name, def);
            this.functionDefs.set(name, def);
        }
        return this;
    }
    /**
     * Компилирует функцию и возвращает её (без выполнения)
     */
    compile(fnName, context) {
        const def = this.functionDefs.get(fnName);
        if (!def) {
            throw new Error(`Function "${fnName}" not found`);
        }
        const params = this.normalizeParams(def.config.params);
        // Создаём замыкание с захваченным контекстом
        const compiledFn = (...args) => {
            // Создаём scope с параметрами
            const scope = new Map();
            // Добавляем переменные из контекста
            if (context?.variables) {
                for (const [key, value] of Object.entries(context.variables)) {
                    scope.set(key, value);
                }
            }
            // Добавляем параметры функции
            params.forEach((param, i) => {
                scope.set(param, args[i]);
            });
            // Callback при вызове
            context?.onCall?.(fnName, args);
            // Debug mode
            if (def.config.debug) {
                console.log(`[DEBUG] ${fnName} called with:`, args);
            }
            // Выполняем тело функции
            const result = this.executeBlock(def.config.body, scope, context);
            let returnValue;
            // Если был return в body — возвращаем его
            if (result && result.__return__) {
                returnValue = result.value;
            }
            else if (def.config.return) {
                // Иначе вычисляем return expression
                returnValue = this.evalExpr(def.config.return, scope, context);
            }
            // Debug mode
            if (def.config.debug) {
                console.log(`[DEBUG] ${fnName} returned:`, returnValue);
            }
            // Callback при return
            context?.onReturn?.(fnName, returnValue);
            return returnValue;
        };
        // Кэшируем скомпилированную функцию
        this.compiledFunctions.set(fnName, compiledFn);
        return compiledFn;
    }
    /**
     * Компилирует все функции и возвращает объект с ними
     */
    compileAll(context) {
        const result = {};
        for (const name of this.functionDefs.keys()) {
            result[name] = this.compile(name, context);
        }
        return result;
    }
    /**
     * Получить скомпилированную функцию (если уже скомпилирована)
     */
    get(fnName) {
        return this.compiledFunctions.get(fnName);
    }
    /**
     * Получить список функций
     */
    listFunctions() {
        const list = [];
        for (const [name, def] of this.functionDefs) {
            list.push({
                name,
                description: def.config.description || '',
                params: this.normalizeParams(def.config.params),
            });
        }
        return list;
    }
    /**
     * Добавить встроенную функцию
     */
    addBuiltin(name, fn) {
        this.builtins[name] = fn;
        return this;
    }
    // ============ PRIVATE METHODS ============
    createBuiltins() {
        return {
            abs: (x) => Math.abs(x),
            floor: (x) => Math.floor(x),
            ceil: (x) => Math.ceil(x),
            round: (x) => Math.round(x),
            min: (...args) => Math.min(...args),
            max: (...args) => Math.max(...args),
            pow: (x, y) => Math.pow(x, y),
            sqrt: (x) => Math.sqrt(x),
            random: () => Math.random(),
            len: (x) => (Array.isArray(x) || typeof x === 'string') ? x.length : 0,
            keys: (obj) => Object.keys(obj || {}),
            values: (obj) => Object.values(obj || {}),
            entries: (obj) => Object.entries(obj || {}),
            isArray: (x) => Array.isArray(x),
            isNumber: (x) => typeof x === 'number',
            isString: (x) => typeof x === 'string',
            isObject: (x) => x !== null && typeof x === 'object' && !Array.isArray(x),
            isNull: (x) => x === null || x === undefined,
            toNumber: (x) => Number(x),
            toString: (x) => String(x),
            toJson: (x) => JSON.stringify(x),
            fromJson: (x) => JSON.parse(x),
            log: (...args) => console.log('[DSL]', ...args),
        };
    }
    normalizeParams(params) {
        if (!params || params.length === 0)
            return [];
        if (typeof params[0] === 'string') {
            return params;
        }
        return params.map((p) => p.name);
    }
    validateFunction(name, def) {
        if (def.type !== 'FUNCTION') {
            throw new Error(`Function "${name}": type must be "FUNCTION"`);
        }
        if (!def.config) {
            throw new Error(`Function "${name}": config is required`);
        }
        if (!def.config.params || !Array.isArray(def.config.params)) {
            throw new Error(`Function "${name}": config.params must be an array`);
        }
        if (!def.config.body || !Array.isArray(def.config.body)) {
            throw new Error(`Function "${name}": config.body must be an array`);
        }
    }
    executeBlock(statements, scope, context) {
        for (const stmt of statements) {
            const result = this.executeStmt(stmt, scope, context);
            if (result && result.__return__) {
                return result;
            }
        }
        return null;
    }
    executeStmt(stmt, scope, context) {
        // LET: { let: "name", value: expr }
        if ('let' in stmt) {
            const s = stmt;
            const value = this.evalExpr(s.value, scope, context);
            scope.set(s.let, value);
            return null;
        }
        // SET: { set: "name", value: expr }
        if ('set' in stmt) {
            const s = stmt;
            if (!scope.has(s.set)) {
                throw new Error(`Variable "${s.set}" is not defined`);
            }
            const value = this.evalExpr(s.value, scope, context);
            scope.set(s.set, value);
            return null;
        }
        // IF: { if: expr, then: [...], else?: [...] }
        if ('if' in stmt) {
            const s = stmt;
            const cond = this.evalExpr(s.if, scope, context);
            if (cond) {
                return this.executeBlock(s.then || [], scope, context);
            }
            else if (s.else) {
                return this.executeBlock(s.else, scope, context);
            }
            return null;
        }
        // FOR: { for: "item", in: expr, do: [...] }
        if ('for' in stmt) {
            const s = stmt;
            const iterable = this.evalExpr(s.in, scope, context);
            if (!iterable || typeof iterable[Symbol.iterator] !== 'function') {
                throw new Error('for requires an iterable');
            }
            for (const item of iterable) {
                scope.set(s.for, item);
                const result = this.executeBlock(s.do || [], scope, context);
                if (result && result.__return__) {
                    return result;
                }
            }
            return null;
        }
        // WHILE: { while: expr, do: [...] }
        if ('while' in stmt) {
            const s = stmt;
            let iterations = 0;
            const maxIterations = 100000;
            while (this.evalExpr(s.while, scope, context)) {
                if (++iterations > maxIterations) {
                    throw new Error('Maximum iterations exceeded (infinite loop protection)');
                }
                const result = this.executeBlock(s.do || [], scope, context);
                if (result && result.__return__) {
                    return result;
                }
            }
            return null;
        }
        // RETURN: { return: expr }
        if ('return' in stmt) {
            const s = stmt;
            return {
                __return__: true,
                value: this.evalExpr(s.return, scope, context),
            };
        }
        throw new Error(`Unknown statement: ${JSON.stringify(stmt)}`);
    }
    evalExpr(expr, scope, context) {
        if (expr === null || expr === undefined) {
            return null;
        }
        // Shorthand: string → ref, number/boolean → literal
        if (typeof expr === 'string') {
            // Строка — это ссылка на переменную
            if (scope.has(expr)) {
                return scope.get(expr);
            }
            if (context?.builtins && expr in context.builtins) {
                return context.builtins[expr];
            }
            if (expr in this.builtins) {
                return this.builtins[expr];
            }
            throw new Error(`Undefined variable: "${expr}"`);
        }
        if (typeof expr === 'number' || typeof expr === 'boolean') {
            return expr;
        }
        // LITERAL: { literal: value }
        if ('literal' in expr) {
            return expr.literal;
        }
        // REF: { ref: "name" }
        if ('ref' in expr) {
            const e = expr;
            if (scope.has(e.ref)) {
                return scope.get(e.ref);
            }
            if (context?.builtins && e.ref in context.builtins) {
                return context.builtins[e.ref];
            }
            if (e.ref in this.builtins) {
                return this.builtins[e.ref];
            }
            throw new Error(`Undefined variable: "${e.ref}"`);
        }
        // BINARY: { operator: "+", left: expr, right: expr }
        if ('operator' in expr && 'left' in expr && 'right' in expr) {
            const e = expr;
            const left = this.evalExpr(e.left, scope, context);
            const right = this.evalExpr(e.right, scope, context);
            return this.evalBinaryOp(e.operator, left, right);
        }
        // UNARY: { operator: "!", argument: expr }
        if ('operator' in expr && 'argument' in expr) {
            const e = expr;
            const arg = this.evalExpr(e.argument, scope, context);
            return this.evalUnaryOp(e.operator, arg);
        }
        // MEMBER: { object: expr, property: "name" }
        if ('object' in expr && 'property' in expr) {
            const e = expr;
            const obj = this.evalExpr(e.object, scope, context);
            if (obj === null || obj === undefined) {
                return undefined;
            }
            return obj[e.property];
        }
        // INDEX: { object: expr, index: expr }
        if ('object' in expr && 'index' in expr) {
            const e = expr;
            const obj = this.evalExpr(e.object, scope, context);
            const idx = this.evalExpr(e.index, scope, context);
            if (obj === null || obj === undefined) {
                return undefined;
            }
            return obj[idx];
        }
        // CALL: { call: "fnName", arguments: [...] }
        if ('call' in expr) {
            const e = expr;
            const args = (e.arguments || []).map((a) => this.evalExpr(a, scope, context));
            const fnName = e.call;
            if (context?.builtins && fnName in context.builtins) {
                return context.builtins[fnName](...args);
            }
            if (fnName in this.builtins) {
                return this.builtins[fnName](...args);
            }
            if (context?.functions && fnName in context.functions) {
                return context.functions[fnName](...args);
            }
            const compiledFn = this.compiledFunctions.get(fnName);
            if (compiledFn) {
                return compiledFn(...args);
            }
            if (this.functionDefs.has(fnName)) {
                const fn = this.compile(fnName, context);
                return fn(...args);
            }
            throw new Error(`Unknown function: "${fnName}"`);
        }
        // METHOD: { method: "name", object: expr, arguments: [...] }
        if ('method' in expr) {
            const e = expr;
            const obj = this.evalExpr(e.object, scope, context);
            const methodName = e.method;
            if (!this.allowedMethods.has(methodName)) {
                throw new Error(`Method "${methodName}" is not allowed`);
            }
            if (obj === null || obj === undefined) {
                throw new Error(`Cannot call method "${methodName}" on null/undefined`);
            }
            const method = obj[methodName];
            if (typeof method !== 'function') {
                return method;
            }
            const args = (e.arguments || []).map((a) => this.evalExpr(a, scope, context));
            return method.apply(obj, args);
        }
        // TERNARY: { condition: expr, then: expr, else: expr }
        if ('condition' in expr && 'then' in expr && 'else' in expr) {
            const e = expr;
            const cond = this.evalExpr(e.condition, scope, context);
            return cond
                ? this.evalExpr(e.then, scope, context)
                : this.evalExpr(e.else, scope, context);
        }
        // OBJECT: { properties: { key: expr, ... } }
        if ('properties' in expr) {
            const e = expr;
            const result = {};
            for (const [key, valExpr] of Object.entries(e.properties)) {
                result[key] = this.evalExpr(valExpr, scope, context);
            }
            return result;
        }
        // ARRAY: { elements: [...] }
        if ('elements' in expr) {
            const e = expr;
            return e.elements.map((el) => this.evalExpr(el, scope, context));
        }
        throw new Error(`Unknown expression: ${JSON.stringify(expr)}`);
    }
    evalBinaryOp(op, l, r) {
        switch (op) {
            case '+': return l + r;
            case '-': return l - r;
            case '*': return l * r;
            case '/': return r !== 0 ? l / r : 0;
            case '%': return l % r;
            case '==': return l == r;
            case '===': return l === r;
            case '!=': return l != r;
            case '!==': return l !== r;
            case '<': return l < r;
            case '<=': return l <= r;
            case '>': return l > r;
            case '>=': return l >= r;
            case '&&': return l && r;
            case '||': return l || r;
            case '&': return l & r;
            case '|': return l | r;
            case '^': return l ^ r;
            default:
                throw new Error(`Unknown operator: "${op}"`);
        }
    }
    evalUnaryOp(op, arg) {
        switch (op) {
            case '!': return !arg;
            case '-': return -arg;
            case '+': return +arg;
            case '~': return ~arg;
            default:
                throw new Error(`Unknown unary operator: "${op}"`);
        }
    }
}
exports.JsonDslCompiler = JsonDslCompiler;
//# sourceMappingURL=compiler.js.map
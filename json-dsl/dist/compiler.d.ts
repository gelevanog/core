/**
 * JSON DSL Compiler - компилирует JSON-конфигурации в реальные JS-функции
 *
 * Формат функций: { type: "FUNCTION", config: { debug?: boolean, ...params } }
 * Внутренние выражения и statements — упрощённый формат с полными названиями свойств
 */
import type { DslConfig, FunctionInfo, BuiltinFn } from './types';
/** Скомпилированная функция */
export type CompiledFunction<TArgs extends unknown[] = unknown[], TReturn = unknown> = (...args: TArgs) => TReturn;
/** Контекст выполнения функции */
export interface ExecutionContext {
    /** Дополнительные переменные, доступные в функции */
    variables?: Record<string, unknown>;
    /** Дополнительные функции, доступные для вызова */
    functions?: Record<string, CompiledFunction>;
    /** Кастомные builtins */
    builtins?: Record<string, BuiltinFn>;
    /** Callback при вызове функции */
    onCall?: (fnName: string, args: unknown[]) => void;
    /** Callback при return */
    onReturn?: (fnName: string, result: unknown) => void;
}
export declare class JsonDslCompiler {
    private functionDefs;
    private compiledFunctions;
    private builtins;
    private allowedMethods;
    private debugMode;
    constructor();
    /**
     * Загрузка конфигурации из JSON
     */
    load(config: DslConfig): this;
    /**
     * Компилирует функцию и возвращает её (без выполнения)
     */
    compile<TArgs extends unknown[] = unknown[], TReturn = unknown>(fnName: string, context?: ExecutionContext): CompiledFunction<TArgs, TReturn>;
    /**
     * Компилирует все функции и возвращает объект с ними
     */
    compileAll<T extends Record<string, CompiledFunction> = Record<string, CompiledFunction>>(context?: ExecutionContext): T;
    /**
     * Получить скомпилированную функцию (если уже скомпилирована)
     */
    get<TArgs extends unknown[] = unknown[], TReturn = unknown>(fnName: string): CompiledFunction<TArgs, TReturn> | undefined;
    /**
     * Получить список функций
     */
    listFunctions(): FunctionInfo[];
    /**
     * Добавить встроенную функцию
     */
    addBuiltin(name: string, fn: BuiltinFn): this;
    private createBuiltins;
    private normalizeParams;
    private validateFunction;
    private executeBlock;
    private executeStmt;
    private evalExpr;
    private evalBinaryOp;
    private evalUnaryOp;
}
//# sourceMappingURL=compiler.d.ts.map
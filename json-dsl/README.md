# JSON DSL Compiler

Компилятор JSON-конфигураций в исполняемые JavaScript-функции. Без `eval`.

## Особенности

- **Компиляция в функции** — JSON превращается в реальные JS-функции, которые можно передавать и вызывать
- **Контекстное выполнение** — одна функция может работать с разными контекстами (переменные, внешние функции)
- **Безопасность** — нет `eval`, белый список методов
- **TypeScript** — полная типизация

## Быстрый старт

```typescript
import { JsonDslCompiler } from './src';

const compiler = new JsonDslCompiler();
compiler.load(config);

// Компиляция функции
const add = compiler.compile<[number, number], number>('add');

// Вызов скомпилированной функции
const result = add(2, 3); // 5

// Компиляция с контекстом
const calculate = compiler.compile('calculatePrice', {
  variables: { taxRate: 0.08, discount: 0.1 }
});
```

## Структура конфигурации

Функции используют формат `{ type: "FUNCTION", config: { ... } }`:

```json
{
  "functions": {
    "add": {
      "type": "FUNCTION",
      "config": {
        "debug": false,
        "description": "Сложение двух чисел",
        "params": ["a", "b"],
        "body": [],
        "return": { "operator": "+", "left": { "ref": "a" }, "right": { "ref": "b" } }
      }
    }
  }
}
```

## Expressions (выражения)

### Литералы и ссылки

| Тип | Синтаксис | Пример |
|-----|-----------|--------|
| Литерал | `{ "literal": value }` | `{ "literal": 42 }`, `{ "literal": "hello" }` |
| Переменная | `{ "ref": "name" }` | `{ "ref": "total" }` |

### Доступ к свойствам

```jsonc
// obj.property
{ "object": { "ref": "user" }, "property": "name" }

// arr[index]
{ "object": { "ref": "items" }, "index": { "literal": 0 } }
```

### Операции

```jsonc
// Бинарные: +, -, *, /, %, ==, ===, !=, !==, <, <=, >, >=, &&, ||
{ "operator": "+", "left": { "ref": "a" }, "right": { "ref": "b" } }

// Унарные: !, -, +
{ "operator": "!", "argument": { "ref": "flag" } }
```

### Тернарный оператор

```json
{
  "condition": { "operator": ">", "left": { "ref": "x" }, "right": { "literal": 0 } },
  "then": { "literal": "positive" },
  "else": { "literal": "non-positive" }
}
```

### Вызов функций

```jsonc
// Вызов пользовательской или встроенной функции
{ "call": "sumArray", "arguments": [{ "ref": "items" }] }

// Вызов метода объекта (из белого списка)
{ "method": "push", "object": { "ref": "arr" }, "arguments": [{ "ref": "item" }] }
```

### Создание объектов и массивов

```jsonc
// Объект
{ "properties": { "x": { "literal": 1 }, "y": { "ref": "value" } } }

// Массив
{ "elements": [{ "literal": 1 }, { "literal": 2 }, { "literal": 3 }] }
```

## Statements (инструкции)

### Объявление переменной

```json
{ "let": "total", "value": { "literal": 0 } }
```

### Присваивание

```json
{ "set": "total", "value": { "operator": "+", "left": { "ref": "total" }, "right": { "literal": 1 } } }
```

### Условие

```json
{
  "if": { "operator": ">", "left": { "ref": "x" }, "right": { "literal": 10 } },
  "then": [
    { "set": "x", "value": { "literal": 10 } }
  ],
  "else": [
    { "set": "x", "value": { "literal": 0 } }
  ]
}
```

### Цикл for

```json
{
  "for": "item",
  "in": { "ref": "items" },
  "do": [
    { "set": "sum", "value": { "operator": "+", "left": { "ref": "sum" }, "right": { "ref": "item" } } }
  ]
}
```

### Цикл while

```json
{
  "while": { "operator": "<", "left": { "ref": "i" }, "right": { "literal": 10 } },
  "do": [
    { "set": "i", "value": { "operator": "+", "left": { "ref": "i" }, "right": { "literal": 1 } } }
  ]
}
```

### Return

```json
{ "return": { "ref": "result" } }
```

## Контекст выполнения

Скомпилированные функции могут использовать внешний контекст:

```typescript
const compiler = new JsonDslCompiler();
compiler.load(config);

// Контекст с переменными
const fn = compiler.compile('calculatePrice', {
  variables: { taxRate: 0.08, discount: 0.1 }
});

// Контекст с внешними функциями
const fn2 = compiler.compile('processItem', {
  functions: {
    transform: (x) => x.toUpperCase(),
    validate: (x) => x.length > 0
  }
});

// Callbacks для отладки
const fn3 = compiler.compile('myFunction', {
  onCall: (name, args) => console.log(`Calling ${name}`, args),
  onReturn: (name, result) => console.log(`${name} returned`, result)
});
```

## Встроенные функции

### Математика
- `abs(x)`, `floor(x)`, `ceil(x)`, `round(x)`
- `min(...args)`, `max(...args)`
- `pow(x, y)`, `sqrt(x)`, `random()`

### Утилиты
- `len(x)` — длина массива/строки
- `keys(obj)`, `values(obj)`, `entries(obj)`

### Проверка типов
- `isArray(x)`, `isNumber(x)`, `isString(x)`, `isObject(x)`, `isNull(x)`

### Преобразования
- `toNumber(x)`, `toString(x)`, `toJson(x)`, `fromJson(x)`

### Логирование
- `log(...args)` — вывод в консоль

## Разрешённые методы

```
length, push, pop, shift, unshift, slice, concat,
indexOf, includes, find, filter, map, reduce,
join, split, trim, toLowerCase, toUpperCase,
substring, charAt, startsWith, endsWith,
keys, values, entries, hasOwnProperty,
toString, toFixed
```

## Безопасность

- **Нет eval** — весь код интерпретируется через AST
- **Белый список методов** — только разрешённые методы объектов
- **Изолированный scope** — функции не имеют доступа к глобальным объектам

## Интеграция в ядро

JSON DSL Compiler предназначен для интеграции в ядро приложения. Основные сценарии использования:

### 1. Загрузка конфигурации из внешних источников

```typescript
import { JsonDslCompiler } from 'json-dsl';

// Загрузка из файла, базы данных или API
const config = await fetch('/api/functions').then(r => r.json());

const compiler = new JsonDslCompiler();
compiler.load(config);
```

### 2. Регистрация как провайдер функций

```typescript
// core/function-registry.ts
class FunctionRegistry {
  private compiler: JsonDslCompiler;
  
  constructor() {
    this.compiler = new JsonDslCompiler();
  }
  
  loadFromConfig(config: DslConfig) {
    this.compiler.load(config);
  }
  
  getFunction<TArgs extends unknown[], TReturn>(
    name: string, 
    context?: ExecutionContext
  ): (...args: TArgs) => TReturn {
    return this.compiler.compile<TArgs, TReturn>(name, context);
  }
  
  // Список доступных функций
  listFunctions(): FunctionInfo[] {
    return this.compiler.list();
  }
}
```

### 3. Использование с контекстом приложения

```typescript
// Передача сервисов в DSL-функции
const compiler = new JsonDslCompiler();
compiler.load(config);

const processOrder = compiler.compile('processOrder', {
  // Переменные из конфигурации приложения
  variables: {
    taxRate: appConfig.taxRate,
    currency: appConfig.currency,
  },
  // Внешние функции из ядра
  functions: {
    sendEmail: emailService.send.bind(emailService),
    logEvent: analytics.track.bind(analytics),
    getUser: userService.getById.bind(userService),
  },
  // Дополнительные встроенные функции
  builtins: {
    formatCurrency: (amount: number) => `${amount.toFixed(2)} ${appConfig.currency}`,
    now: () => new Date().toISOString(),
  },
});

// Вызов с данными
const result = processOrder(orderData);
```

### 4. Динамическое обновление функций

```typescript
// Горячая перезагрузка функций без перезапуска приложения
class HotReloadableFunctions {
  private compiler: JsonDslCompiler;
  private cache = new Map<string, CompiledFunction>();
  
  async reload() {
    const newConfig = await this.fetchConfig();
    this.compiler = new JsonDslCompiler();
    this.compiler.load(newConfig);
    this.cache.clear(); // Сброс кэша
  }
  
  get(name: string, context?: ExecutionContext) {
    const key = `${name}:${JSON.stringify(context?.variables || {})}`;
    
    if (!this.cache.has(key)) {
      this.cache.set(key, this.compiler.compile(name, context));
    }
    
    return this.cache.get(key)!;
  }
}
```

### 5. Мультитенантность

```typescript
// Разные конфигурации для разных клиентов
class TenantFunctionProvider {
  private compilers = new Map<string, JsonDslCompiler>();
  
  loadTenant(tenantId: string, config: DslConfig) {
    const compiler = new JsonDslCompiler();
    compiler.load(config);
    this.compilers.set(tenantId, compiler);
  }
  
  getFunction(tenantId: string, fnName: string, context?: ExecutionContext) {
    const compiler = this.compilers.get(tenantId);
    if (!compiler) throw new Error(`Tenant ${tenantId} not found`);
    return compiler.compile(fnName, context);
  }
}
```

## Пример: полная функция

```json
{
  "fibonacci": {
    "type": "FUNCTION",
    "config": {
      "description": "N-ое число Фибоначчи",
      "params": ["n"],
      "body": [
        {
          "if": { "operator": "<=", "left": { "ref": "n" }, "right": { "literal": 1 } },
          "then": [{ "return": { "ref": "n" } }]
        },
        { "let": "a", "value": { "literal": 0 } },
        { "let": "b", "value": { "literal": 1 } },
        { "let": "i", "value": { "literal": 2 } },
        {
          "while": { "operator": "<=", "left": { "ref": "i" }, "right": { "ref": "n" } },
          "do": [
            { "let": "temp", "value": { "ref": "b" } },
            { "set": "b", "value": { "operator": "+", "left": { "ref": "a" }, "right": { "ref": "b" } } },
            { "set": "a", "value": { "ref": "temp" } },
            { "set": "i", "value": { "operator": "+", "left": { "ref": "i" }, "right": { "literal": 1 } } }
          ]
        }
      ],
      "return": { "ref": "b" }
    }
  }
}
```

## Запуск

```bash
# Установка зависимостей
npm install

# Сборка
npm run build

# Демо
npm run demo
```

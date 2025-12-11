/**
 * Демонстрация JSON DSL Compiler
 * 
 * Формат функций: { type: "FUNCTION", config: { debug?: boolean, ...params } }
 * Внутренние выражения и statements — упрощённый формат
 */

import { JsonDslCompiler, DslConfig } from './src';

// ============ Конфигурация функций ============

const config: DslConfig = {
  functions: {
    // Простое сложение
    add: {
      type: 'CALLBACK',
      config: {
        description: 'Сложение двух чисел',
        params: ['a', 'b'],
        body: [],
        return: { operator: '+', left: { ref: 'a' }, right: { ref: 'b' } },
      },
    },

    // Умножение
    multiply: {
      type: 'CALLBACK',
      config: {
        description: 'Умножение двух чисел',
        params: ['a', 'b'],
        body: [],
        return: { operator: '*', left: { ref: 'a' }, right: { ref: 'b' } },
      },
    },

    // Расчёт цены с налогом и скидкой (переменные из контекста)
    calculatePrice: {
      type: 'CALLBACK',
      config: {
        description: 'Расчёт цены с учётом налога и скидки',
        params: ['basePrice'],
        body: [
          {
            let: 'priceWithTax',
            value: {
              operator: '*',
              left: { ref: 'basePrice' },
              right: { operator: '+', left: { literal: 1 }, right: { ref: 'taxRate' } },
            },
          },
          {
            let: 'finalPrice',
            value: {
              operator: '*',
              left: { ref: 'priceWithTax' },
              right: { operator: '-', left: { literal: 1 }, right: { ref: 'discount' } },
            },
          },
        ],
        return: { ref: 'finalPrice' },
      },
    },

    // Сумма массива
    sumArray: {
      type: 'CALLBACK',
      config: {
        description: 'Сумма элементов массива',
        params: ['items'],
        body: [
          { let: 'total', value: { literal: 0 } },
          {
            for: 'item',
            in: { ref: 'items' },
            do: [
              {
                set: 'total',
                value: { operator: '+', left: { ref: 'total' }, right: { ref: 'item' } },
              },
            ],
          },
        ],
        return: { ref: 'total' },
      },
    },

    // Приветствие (greeting из контекста)
    greet: {
      type: 'CALLBACK',
      config: {
        description: 'Приветствие',
        params: ['name'],
        body: [],
        return: { operator: '+', left: { ref: 'greeting' }, right: { ref: 'name' } },
      },
    },

    // Факториал
    factorial: {
      type: 'CALLBACK',
      config: {
        description: 'Вычисление факториала',
        debug: false,
        params: ['n'],
        body: [
          { let: 'result', value: { literal: 1 } },
          { let: 'i', value: { literal: 1 } },
          {
            while: { operator: '<=', left: { ref: 'i' }, right: { ref: 'n' } },
            do: [
              {
                set: 'result',
                value: { operator: '*', left: { ref: 'result' }, right: { ref: 'i' } },
              },
              {
                set: 'i',
                value: { operator: '+', left: { ref: 'i' }, right: { literal: 1 } },
              },
            ],
          },
        ],
        return: { ref: 'result' },
      },
    },
  },
};

// ============ Демонстрация ============

const compiler = new JsonDslCompiler();
compiler.load(config);

console.log('='.repeat(60));
console.log('JSON DSL Compiler Demo');
console.log('Формат: { type: "CALLBACK", config: { ... } }');
console.log('='.repeat(60));
console.log();

// 1. Базовая компиляция
console.log('1. Базовая компиляция функций');
console.log('-'.repeat(40));

const add = compiler.compile<[number, number], number>('add');
const multiply = compiler.compile<[number, number], number>('multiply');

console.log('add(2, 3) =', add(2, 3));
console.log('multiply(4, 5) =', multiply(4, 5));
console.log();

// 2. Контекст с переменными
console.log('2. Контекст с переменными');
console.log('-'.repeat(40));

const calculatePriceUS = compiler.compile<[number], number>('calculatePrice', {
  variables: { taxRate: 0.08, discount: 0.1 },
});

const calculatePriceEU = compiler.compile<[number], number>('calculatePrice', {
  variables: { taxRate: 0.20, discount: 0.05 },
});

console.log('US: calculatePrice(100) =', calculatePriceUS(100).toFixed(2));
console.log('EU: calculatePrice(100) =', calculatePriceEU(100).toFixed(2));
console.log();

// 3. Сумма массива
console.log('3. Сумма массива (for loop)');
console.log('-'.repeat(40));

const sumArray = compiler.compile<[number[]], number>('sumArray');
console.log('sumArray([1, 2, 3, 4, 5]) =', sumArray([1, 2, 3, 4, 5]));
console.log('sumArray([10, 20, 30]) =', sumArray([10, 20, 30]));
console.log();

// 4. Динамическая смена контекста
console.log('4. Динамическая смена контекста');
console.log('-'.repeat(40));

const greetRu = compiler.compile<[string], string>('greet', { variables: { greeting: 'Привет, ' } });
const greetEn = compiler.compile<[string], string>('greet', { variables: { greeting: 'Hello, ' } });

console.log('greetRu("Иван") =', greetRu('Иван'));
console.log('greetEn("John") =', greetEn('John'));
console.log();

// 5. Factorial
console.log('5. Factorial (while loop)');
console.log('-'.repeat(40));

const factorial = compiler.compile<[number], number>('factorial');
console.log('factorial(5) =', factorial(5));
console.log('factorial(10) =', factorial(10));
console.log();

// 6. Пример JSON структуры
console.log('6. Пример JSON структуры');
console.log('-'.repeat(40));

const exampleJson = {
  add: {
    type: 'CALLBACK',
    config: {
      description: 'Сложение двух чисел',
      params: ['a', 'b'],
      body: [],
      return: { operator: '+', left: { ref: 'a' }, right: { ref: 'b' } },
    },
  },
};

console.log(JSON.stringify(exampleJson, null, 2));
console.log();

console.log('='.repeat(60));
console.log('Demo completed!');

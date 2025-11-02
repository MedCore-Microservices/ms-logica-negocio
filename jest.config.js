// jest.config.js
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/?(*.)+(spec|test).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx,js}',
    '!src/**/*.d.ts',
  ],
  // Deshabilitar automocking para evitar el error
  automock: false,
  // Configuración para limpiar mocks entre tests
  clearMocks: true,
  resetMocks: false,
};
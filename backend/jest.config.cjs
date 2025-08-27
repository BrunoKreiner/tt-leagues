/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  transform: {},
  moduleFileExtensions: ['js', 'json'],
  collectCoverageFrom: ['src/**/*.js'],
};



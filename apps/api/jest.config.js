/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
  collectCoverageFrom: ["**/*.ts", "!**/*.module.ts", "!main.ts", "!worker.ts", "!seed.ts"],
  coverageDirectory: "../coverage",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@shared/(.*)$": "<rootDir>/@shared/$1",
    "^@lib/(.*)$": "<rootDir>/@lib/$1",
    "^@logic/(.*)$": "<rootDir>/@logic/$1",
  },
};

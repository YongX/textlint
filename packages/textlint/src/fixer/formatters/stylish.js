"use strict";
const chalk = require("chalk");
const table = require("text-table");
const widthOfString = require("string-width");

/**
 * Given a word and a count, append an s if count is not one.
 * @param {string} word A word in its singular form.
 * @param {int} count A number controlling whether word should be pluralized.
 * @returns {string} The original word with an s on the end if count is not one.
 */
function pluralize(word, count) {
    return (count === 1 ? word : word + "s");
}

module.exports = function(results, options) {
    // default: true
    chalk.enabled = options.color !== undefined ? options.color : true;
    let output = "\n";
    let totalFixed = 0;
    let errors = 0;
    const summaryColor = "yellow";
    const greenColor = "green";

    results.forEach(function(result) {
        if (!result.applyingMessages || !result.remainingMessages) {
            return;
        }
        const messages = result.applyingMessages;
        // still error count
        const remainingMessages = result.remainingMessages;
        errors += remainingMessages.length;
        if (messages.length === 0) {
            return;
        }
        output += chalk.underline(result.filePath) + "\n";

        output += table(
                messages.map(function(message) {
                    // fixable
                    totalFixed++;
                    const messageType = chalk[greenColor].bold("\u2714 ");

                    return [
                        "",
                        message.line || 0,
                        message.column || 0,
                        messageType,
                        message.message.replace(/\.$/, ""),
                        chalk.gray(message.ruleId || "")
                    ];
                }),
                {
                    align: ["", "r", "l"],
                    stringLength: function(str) {
                        const lines = chalk.stripColor(str).split("\n");
                        return Math.max.apply(null, lines.map(function(line) {
                            return widthOfString(line);
                        }));
                    }
                }
            ).split("\n").map(function(el) {
                return el.replace(/(\d+)\s+(\d+)/, function(m, p1, p2) {
                    return chalk.gray(p1 + ":" + p2);
                });
            }).join("\n") + "\n\n";
    });

    if (totalFixed > 0) {
        output += chalk[greenColor].bold([
            // http://www.fileformat.info/info/unicode/char/2714/index.htm
            "\u2714 Fixed ", totalFixed, pluralize(" problem", totalFixed), "\n"
        ].join(""));
    }

    if (errors > 0) {
        output += chalk[summaryColor].bold([
            // http://www.fileformat.info/info/unicode/char/2716/index.htm
            "\u2716 Remaining ", errors, pluralize(" problem", errors), "\n"
        ].join(""));
    }

    return totalFixed > 0 ? output : "";
};

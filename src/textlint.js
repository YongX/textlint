// LICENSE : MIT
'use strict';
/*
    Api is an implemented of linting text.


    # Usage

    First, register rules by `api.setupRules`.
    Second, lint text and get `TextLintResult` by `api.lint*`.
    Finally, cleanup by `api.resetRules`.

    ## Concept

    `textlint.js` intended to lint for a single file.

    `textlint.js` is Core API. So, carefully use it.
    You should manage `setupRules` and `resetRules` by the hand.

    ## FAQ?

    Q. How to handle multiple files?

    A. Use `cli-engine` which is wrapped `textlint.js`.

    ## More detail workflow

    - load rules
    - addEventLister each **event** of rule {@link api.setupRules}
    - parse text to AST(TxtNode)
    - traverse ast -> emit **event**
        - report(push message)
    - display messages with formatter


 */
const objectAssign = require('object-assign');
const TraverseController = require('txt-ast-traverse').Controller;
const RuleContext = require('./rule/rule-context');
const ruleManager = require('./rule/rule-manager');
const path = require('path');
const fs = require('fs');
const EventEmitter = require('events').EventEmitter;
const debug = require('debug')('text:core');
// instance variable
let messages = [];
let currentText = null;
const api = Object.create(new EventEmitter());
// add all the node types as listeners
function addListenRule(rule, target) {
    Object.keys(rule).forEach(nodeType => {
        target.on(nodeType, rule[nodeType]);
    });
}
function initializeLinting(text) {
    messages = [];
    currentText = text;
}
/**
 * Register rules to EventEmitter.
 * if want to release rules, please call {@link api.resetRules}.
 * @param {object} rules rule objects array
 * @param {object} [rulesConfig] ruleConfig is object
 * @param {TextLintConfig} [textLintConfig]
 */
api.setupRules = function (rules, rulesConfig, textLintConfig) {
    Object.keys(rules).forEach(key => {
        debug('use "%s" rule', key);
        const ruleCreator = rules[key];
        if (typeof ruleCreator !== 'function') {
            throw new Error(`Definition for rule '${ key }' was not found.`);
        }
        let rule;
        const ruleConfig = rulesConfig && rulesConfig[key];
        // "rule-name" : false => disable
        // TODO: move to RuleManager?
        if (ruleConfig === false) {
            return;
        }
        try {
            rule = ruleCreator(new RuleContext(key, api, textLintConfig), ruleConfig);
            addListenRule(rule, api);
        } catch (ex) {
            ex.message = `Error while loading rule '${ key }': ${ ex.message }`;
            throw ex;
        }
    });
};
/**
 * Remove all registered rule and clear messages.
 */
api.resetRules = function () {
    this.removeAllListeners();
    ruleManager.resetRules();
    messages = [];
    currentText = null;
};
/**
 * lint plain text by registered rules.
 * The result contains target filePath and error messages.
 * @param {string} text
 * @returns {TextLintResult}
 */
api.lintText = function (text) {
    require('assert')(text.length > 0);
    initializeLinting(text);
    const parse = require('txt-to-ast').parse;
    const ast = parse(text);
    const controller = new TraverseController();
    controller.traverse(ast, {
        enter(node, parent) {
            Object.defineProperty(node, 'parent', {value: parent});
            api.emit(node.type, node);
        },
        leave(node) {
            api.emit(`${ node.type }:exit`, node);
        }
    });
    return {
        filePath: '<text>',
        messages: messages
    };
};
/**
 * lint markdown text by registered rules.
 * The result contains target filePath and error messages.
 * @param {string} markdown markdown format text
 * @returns {TextLintResult}
 */
api.lintMarkdown = function (markdown) {
    require('assert')(markdown.length > 0);
    initializeLinting(markdown);
    const parse = require('markdown-to-ast').parse;
    const ast = parse(markdown);
    const controller = new TraverseController();
    controller.traverse(ast, {
        enter(node, parent) {
            Object.defineProperty(node, 'parent', {value: parent});
            api.emit(node.type, node);
        },
        leave(node) {
            api.emit(`${ node.type }:exit`, node);
        }
    });
    return {
        filePath: '<markdown>',
        messages: messages
    };
};
/**
 * lint file and return result object
 * @param {string} filePath
 * @returns {TextLintResult} result
 */
api.lintFile = function (filePath) {
    const absoluteFilePath = path.resolve(process.cwd(), filePath);
    const text = fs.readFileSync(absoluteFilePath, 'utf-8');
    if (require('is-md')(filePath)) {
        return objectAssign(api.lintMarkdown(text), {filePath: absoluteFilePath});
    } else {
        return objectAssign(api.lintText(text), {filePath: absoluteFilePath});
    }
};
// ===== Export RuleContext
/**
 * push new RuleError to results
 * @param {string} ruleId
 * @param {TxtNode} txtNode
 * @param {RuleError} error
 */
api.pushReport = function (ruleId, txtNode, error) {
    debug('api.pushReport %s', error);
    messages.push(objectAssign({
        ruleId: ruleId,
        message: error.message,
        line: error.line ? txtNode.loc.start.line + error.line : txtNode.loc.start.line,
        column: error.column ? txtNode.loc.start.column + error.column : txtNode.loc.start.column,
        severity: 2
    }, txtNode));
};
/**
 * Gets the source code for the given node.
 * @param {TxtNode=} node The AST node to get the text for.
 * @param {int=} beforeCount The number of characters before the node to retrieve.
 * @param {int=} afterCount The number of characters after the node to retrieve.
 * @returns {string} The text representing the AST node.
 */
api.getSource = function (node, beforeCount, afterCount) {
    if (node) {
        return currentText !== null
            ? currentText.slice(Math.max(node.range[0] - (beforeCount || 0), 0), node.range[1] + (afterCount || 0))
            : null;
    } else {
        return currentText;
    }
};
module.exports = api;
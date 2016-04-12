import { List, Map } from "immutable";
import { assert } from "./errors";
import BindingMap from "./binding-map";
import { Maybe } from "ramda-fantasy";
import * as _ from 'ramda';
const Just = Maybe.Just;
const Nothing = Maybe.Nothing;

import { TokenType, TokenClass } from "shift-parser/dist/tokenizer";

function sizeDecending(a, b) {
  if (a.scopes.size > b.scopes.size) {
    return -1;
  } else if (b.scopes.size > a.scopes.size) {
    return 1;
  } else {
    return 0;
  }
}

export let Types = {
  null: {
    match: token => !Types.delimiter.match(token) && token.type === TokenType.NULL,
    create: (value, stx) => new Syntax({
      type: TokenType.NULL,
      value: null
    }, stx.context)
  },
  number: {
    match: token => !Types.delimiter.match(token) && token.type.klass === TokenClass.NumericLiteral,
    create: (value, stx) => new Syntax({
      type: TokenType.NUMBER,
      value
    }, stx.context)
  },
  string: {
		match: token => !Types.delimiter.match(token) && token.type.klass === TokenClass.StringLiteral,
    create: (value, stx) => new Syntax({
      type: TokenType.STRING,
      str: value
    }, stx.context)
  },
  punctuator: {
		match: token => !Types.delimiter.match(token) && token.type.klass === TokenClass.Punctuator,
    create: (value, stx) => new Syntax({
      type: {
        klass: TokenClass.Punctuator,
        name: value
      },
      value
    }, stx.context)
  },
  keyword: {
		match: token => !Types.delimiter.match(token) && token.type.klass === TokenClass.Keyword,
    create: (value, stx) => new Syntax({
      type: {
        klass: TokenClass.Keyword,
        name: value
      },
      value
    }, stx.context)
  },
  identifier: {
		match: token => !Types.delimiter.match(token) && token.type.klass === TokenClass.Ident,
    create: (value, stx) => new Syntax({
      type: TokenType.IDENTIFIER,
      value
    }, stx.context)
  },
  regularExpression: {
		match: token => !Types.delimiter.match(token) && token.type.klass === TokenClass.RegularExpression,
    create: (value, stx) => new Syntax({
      type: TokenType.REGEXP,
      value
    }, stx.context)
  },
  braces: {
		match: token => Types.delimiter.match(token) &&
           token.get(0).token.type === TokenType.LBRACE,
    create: (inner, stx) => {
      let left = new Syntax({
        type: TokenType.LBRACE,
        value: "{"
      });
      let right = new Syntax({
        type: TokenType.RBRACE,
        value: "}"
      });
      return new Syntax(List.of(left).concat(inner).push(right), stx.context);
    }
  },
  brackets: {
		match: token => Types.delimiter.match(token) &&
           token.get(0).token.type === TokenType.LBRACK,
    create: (inner, stx) => {
      let left = new Syntax({
        type: TokenType.LBRACK,
        value: "["
      });
      let right = new Syntax({
        type: TokenType.RBRACK,
        value: "]"
      });
      return new Syntax(List.of(left).concat(inner).push(right), stx.context);
    }
  },
  parens: {
		match: token => Types.delimiter.match(token) &&
           token.get(0).token.type === TokenType.LPAREN,
    create: (inner, stx) => {
      let left = new Syntax({
        type: TokenType.LPAREN,
        value: "("
      });
      let right = new Syntax({
        type: TokenType.RPAREN,
        value: ")"
      });
      return new Syntax(List.of(left).concat(inner).push(right), stx.context);
    }
  },

  assign: {
    match: token => {
      if (Types.punctuator.match(token)) {
        switch (token.value) {
          case "=":
          case "|=":
          case "^=":
          case "&=":
          case "<<=":
          case ">>=":
          case ">>>=":
          case "+=":
          case "-=":
          case "*=":
          case "/=":
          case "%=":
            return true;
          default:
            return false;
        }
      }
      return false;
    }
  },

  boolean: {
    match: token => !Types.delimiter.match(token) && token.type === TokenType.TRUE ||
           token.type === TokenType.FALSE
  },

  template: {
    match: token => !Types.delimiter.match(token) && token.type === TokenType.TEMPLATE
  },

  delimiter: {
    match: token => List.isList(token)
  },

  syntaxTemplate: {
    match: token => Types.delimiter.match(token) && token.get(0).val() === '#`'
  },

  eof: {
    match: token => !Types.delimiter.match(token) && token.type === TokenType.EOS
  },
};

export default class Syntax {
  constructor(token, oldstx = {}) {
    this.token = token;
    this.bindings = oldstx.bindings != null ? oldstx.bindings : new BindingMap();
    this.scopesetMap = oldstx.scopesetMap != null ? oldstx.scopesetMap : Map();
    Object.freeze(this);
  }

  static of(token, stx = {}) {
    return new Syntax(token, stx);
  }

  static from(type, value, stx = {}) {
    if (!Types[type]) {
      throw new Error(type + " is not a valid type");
    }
    else if (!Types[type].create) {
      throw new Error("Cannot create a syntax from type " + type);
    }
    return Types[type].create(value, stx);
  }

  static fromNull(stx = {}) {
    return Syntax.from("null", null, stx);
  }

  static fromNumber(value, stx = {}) {
    return Syntax.from("number", value, stx);
  }

  static fromString(value, stx = {}) {
    return Syntax.from("string", value, stx);
  }

  static fromPunctuator(value, stx = {}) {
    return Syntax.from("punctuator", value, stx);
  }

  static fromKeyword(value, stx = {}) {
    return Syntax.from("keyword", value, stx);
  }

  static fromIdentifier(value, stx = {}) {
    return Syntax.from("identifier", value, stx);
  }

  static fromRegularExpression(value, stx = {}) {
    return Syntax.from("regularExpression", value, stx);
  }

  static fromBraces(inner, stx = {}) {
    return Syntax.from("braces", inner, stx);
  }

  static fromBrackets(inner, stx = {}) {
    return Syntax.from("brackets", inner, stx);
  }

  static fromParens(inner, stx = {}) {
    return Syntax.from("parens", inner, stx);
  }

  // () -> string
  resolve(phase) {
    assert(phase != null, "must provide a phase to resolve");
    let stxScopes = this.scopesetMap.has(phase) ? this.scopesetMap.get(phase) : List();
    if (stxScopes.size === 0 || !(this.match('identifier') || this.match('keyword'))) {
      return this.token.value;
    }
    let scope = stxScopes.last();
    let bindings = this.bindings;
    if (scope) {
      // List<{ scopes: List<Scope>, binding: Symbol }>
      let scopesetBindingList = bindings.get(this);

      if (scopesetBindingList) {
        // { scopes: List<Scope>, binding: Symbol }
        let biggestBindingPair = scopesetBindingList.filter(({scopes, binding}) => {
          return scopes.isSubset(stxScopes);
        }).sort(sizeDecending);

        if (biggestBindingPair.size >= 2 &&
            biggestBindingPair.get(0).scopes.size === biggestBindingPair.get(1).scopes.size) {
          let debugBase = '{' + stxScopes.map(s => s.toString()).join(', ') + '}';
          let debugAmbigousScopesets = biggestBindingPair.map(({scopes}) => {
            return '{' + scopes.map(s => s.toString()).join(', ') + '}';
          }).join(', ');
          throw new Error('Scopeset ' + debugBase + ' has ambiguous subsets ' + debugAmbigousScopesets);
        } else if (biggestBindingPair.size !== 0) {
          let bindingStr = biggestBindingPair.get(0).binding.toString();
          if (Maybe.isJust(biggestBindingPair.get(0).alias)) {
            // null never happens because we just checked if it is a Just
            return biggestBindingPair.get(0).alias.getOrElse(null).resolve(phase);
          }
          return bindingStr;
        }
      }
    }
    return this.token.value;
  }

  val() {
    assert(!this.match("delimiter"), "cannot get the val of a delimiter");
    if (this.match("string")) {
      return this.token.str;
    }
    if (this.match("template")) {
      return this.token.items.map(el => {
        if (el instanceof Syntax && el.match("delimiter")) {
          return '${...}';
        }
        return el.slice.text;
      }).join('');
    }
    return this.token.value;
  }

  lineNumber() {
    if (!this.match("delimiter")) {
      return this.token.slice.startLocation.line;
    } else {
      return this.token.get(0).lineNumber();
    }
  }

  setLineNumber(line) {
    let newTok = {};
    if (this.isDelimiter()) {
      newTok = this.token.map(s => s.setLineNumber(line));
    } else {
      for (let key of Object.keys(this.token)) {
        newTok[key] = this.token[key];
      }
      assert(newTok.slice && newTok.slice.startLocation, 'all tokens must have line info');
      newTok.slice.startLocation.line = line;
    }
    return new Syntax(newTok, this.context);
  }

  // () -> List<Syntax>
  inner() {
    assert(this.match("delimiter"), "can only get the inner of a delimiter");
    return this.token.slice(1, this.token.size - 1);
  }

  addScope(scope, bindings, phase, options = { flip: false }) {
    let token = this.match('delimiter') ? this.token.map(s => s.addScope(scope, bindings, phase, options)) : this.token;
    if (this.match('template')) {
      token = {
        type: this.token.type,
        items: token.items.map(it => {
          if (it instanceof Syntax && it.match('delimiter')) {
            return it.addScope(scope, bindings, phase, options);
          }
          return it;
        })
      };
    }
    let oldScopeset = this.scopesetMap.has(phase) ? this.scopesetMap.get(phase) : List();
    let newScopeset;
    if (options.flip) {
      let index = oldScopeset.indexOf(scope);
      if (index !== -1) {
        newScopeset = oldScopeset.remove(index);
      } else {
        newScopeset = oldScopeset.push(scope);
      }
    } else {
      newScopeset = oldScopeset.push(scope);
    }
    let newstx = {
      scopesetMap: this.scopesetMap.set(phase, newScopeset), bindings
    };
    return new Syntax(token, newstx);
  }

  removeScope(scope, phase) {
    let token = this.match('delimiter') ? this.token.map(s => s.removeScope(scope, phase)) : this.token;
    let newScopeset = this.scopesetMap.has(phase) ? this.scopesetMap.get(phase) : List();
    let index = newScopeset.indexOf(scope);
    if (index !== -1) {
      newScopeset = newScopeset.remove(index);
    }
    let newstx = {
      bindings: this.bindings,
      scopesetMap: this.scopesetMap.set(phase, newScopeset)
    };
    return new Syntax(token, newstx);
  }

  match(type, value) {
    if (!Types[type]) {
      throw new Error(type + " is an invalid type");
    }
    return Types[type].match(this.token) && (value == null ||
      value instanceof RegExp ? value.test(this.val()) : this.val() == value);
  }

  isIdentifier(value) {
    return this.match("identifier", value);
  }

  isAssign(value) {
    return this.match("assign", value);
  }

  isBooleanLiteral(value) {
    return this.match("boolean", value);
  }

  isKeyword(value) {
    return this.match("keyword", value);
  }

  isNullLiteral(value) {
    return this.match("null", value);
  }

  isNumericLiteral(value) {
    return this.match("number", value);
  }

  isPunctuator(value) {
    return this.match("punctuator", value);
  }

  isStringLiteral(value) {
    return this.match("string", value);
  }

  isRegularExpression(value) {
    return this.match("regularExpression", value);
  }

  isTemplate(value) {
    return this.match("template", value);
  }

  isDelimiter(value) {
    return this.match("delimiter", value);
  }

  isParens(value) {
    return this.match("parens", value);
  }

  isBraces(value) {
    return this.match("braces", value);
  }

  isBrackets(value) {
    return this.match("brackets", value);
  }

  isSyntaxTemplate(value) {
    return this.match("syntaxTemplate", value);
  }

  isEOF(value) {
    return this.match("eof", value);
  }

  toString() {
    if (this.match("delimiter")) {
      return this.token.map(s => s.toString()).join(" ");
    }
    if (this.match("string")) {
      return "'" + this.token.str;
    }
    if (this.match("template")) {
      return this.val();
    }
    return this.token.value;
  }
}

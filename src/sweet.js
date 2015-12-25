/* @flow */

import read, { Token } from "./reader";
import Reader from "./shift-reader";
import expand from "./expander";
import { List } from "immutable";
import Syntax from "./syntax";
import Env from "./env";
import { transform } from "babel-core";
import reduce from "shift-reducer";
import ParseReducer from "./parse-reducer";
import codegen from "shift-codegen";

import BindingMap from "./bindingMap.js";

import Term from "./terms";
import { Symbol } from "./symbol";

type SweetOptions = {
    foo?: boolean
}

export function parse(source: string, options: SweetOptions = {}) {
    let reader = new Reader(source);
    let stxl = reader.read();
    let exStxl = expand(stxl, {
        env: new Env(),
        bindings: new BindingMap()
    });
    let ast = reduce.default(new ParseReducer(), new Term("Module", {
        directives: List(),
        items: exStxl
    }));
    return ast;
}

export function compile(source: string) {
    let ast = parse(source);
    let gen = codegen.default(ast);
    return transform(gen);
}


function expandForExport(source: string) {
    let reader = new Reader(source);
    let stxl = reader.read();
    let exStxl = expand(stxl, {
        env: new Env(),
        bindings: new BindingMap()
    });
    return new Term("Module", {
        directives: List(),
        items: exStxl
    });
}
export {expandForExport as expand};

import * as vscode from 'vscode';

let _context: vscode.ExtensionContext;

export function setContext(context: vscode.ExtensionContext) {
    _context = context;
}

export function getContext(): vscode.ExtensionContext {
    return _context;
}
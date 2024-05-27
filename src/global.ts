import {
	ExtensionContext,
  } from 'vscode';

let _context: ExtensionContext;

export function setContext(context: ExtensionContext) {
    _context = context;
}

export function getContext(): ExtensionContext {
    return _context;
}
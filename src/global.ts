import {
	ExtensionContext,
    EventEmitter
  } from 'vscode';

let _context: ExtensionContext;
export const onDidChangeGlobalState = new EventEmitter<void>();

export function setContext(context: ExtensionContext) {
    _context = context;
}

export function getContext(): ExtensionContext {
    return _context;
}


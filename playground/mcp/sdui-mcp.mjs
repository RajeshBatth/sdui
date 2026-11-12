#!/usr/bin/env node
// Launcher for the SDUI MCP server. Works from any working directory: tsx and the server
// resolve relative to this file, so MCP clients can point at it with an absolute path.
import { tsImport } from 'tsx/esm/api';

await tsImport('./server.ts', import.meta.url);

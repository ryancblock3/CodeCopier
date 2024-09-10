# CodeCopier

CodeCopier is a powerful command-line tool designed to help you collect and organize code snippets from multiple files in your project. It's perfect for creating documentation, sharing code examples, or preparing code for review.

## Features

- Configurable file inclusion and exclusion patterns
- Interactive file selection process with progress indication
- Batch selection using glob patterns
- Markdown output with syntax highlighting
- Option to compress output
- Verbose logging for detailed operation information

## Installation

```bash
npm install -g codecopier
```

## Usage

Run CodeCopier in your project directory:

```bash
codecopier [options]
```

### Options

- `-c, --config <path>`: Path to the configuration file
- `-o, --output <filename>`: Output file name (default: 'codecopier_output.md')
- `-z, --compress`: Compress the output file
- `-v, --verbose`: Run with verbose logging
- `--help`: Show help information

## Configuration

CodeCopier uses a configuration file to determine which files to include or exclude. By default, it looks for a `.codecopierrc.json` file in the current directory. You can also specify a custom configuration file using the `--config` option.

Example configuration:

```json
{
  "exclude": ["node_modules/**", ".git/**"],
  "include": ["**/*.{js,ts,py,java,c,cpp,h,hpp,css,html}"]
}
```

If no configuration file is found, CodeCopier uses default settings to include common code file types and exclude `node_modules` and `.git` directories.

## File Selection

CodeCopier offers an interactive file selection process with the following options:

- `y`: Include the file
- `n`: Exclude the file
- `p`: Enter a glob pattern to select multiple files at once
- `q`: Quit the selection process

When using the `p` option, you can enter glob patterns like `*.js` or `src/**/*.ts` to select multiple files matching the pattern.

## Output

CodeCopier generates a Markdown file containing the selected code snippets, organized by file and with appropriate syntax highlighting. If the compress option is used, the output will be gzipped.

## Progress Indication

During the file selection process, CodeCopier displays a progress bar to show how many files have been processed, giving you a clear indication of your progress through large projects.

## Error Handling

CodeCopier provides detailed error messages and, when run with the verbose flag, includes stack traces to help diagnose any issues that may occur during operation.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[MIT License](LICENSE)

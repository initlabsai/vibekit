## Compile TEAL

### Compile TEAL source to bytecode

Compile TEAL source code into bytecode via the algod node.

```python
teal_source = "#pragma version 10\nint 1\nreturn"

compiled = algorand.app.compile_teal(teal_source)

compiled.compiled                  # str — base64-encoded compiled program
compiled.compiled_base64_to_bytes  # bytes — raw compiled bytecode
compiled.compiled_hash             # str — program hash (SHA-512/256 address)
compiled.source_map                # ProgramSourceMap | None — source mapping
```

**What just happened:** `algorand.app.compile_teal()` sent the TEAL source to the algod node for compilation and returned a `CompiledTeal` object. Results are cached — compiling the same source again returns the cached result without hitting algod. The `compiled_hash` is the program address, useful for logic signature accounts.

### Compile with template variable substitution

Replace TEAL template placeholders before compilation.

```python
teal_template = "#pragma version 10\nint TMPL_THRESHOLD\nreturn"

compiled = algorand.app.compile_teal_template(
    teal_template,
    template_params={"THRESHOLD": 100},
)
```

**What just happened:** The SDK replaced `TMPL_THRESHOLD` with `100` in the TEAL source before compiling. Dict keys can omit the `TMPL_` prefix — the SDK auto-prepends it. Value type mapping: `int` → string literal, `str` → `0x` + UTF-8 hex, `bytes` → `0x` + hex.

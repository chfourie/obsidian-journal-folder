### Local testing with an external vault

1. Create a symlink to the project in the vault.

```shell
ln -s "$(pwd)" "/${path-to-vault}/.obsidian/plugins/journal-folder"
```

2. Run devmode

```shell
npx npm run dev
```



# Journal Folder Plugin

This plugin provides utilities for use with folder based journaling.  The term _"folder based journaling"_ implies the ability to use any arbitrary folder within an _Obsidian_ vault as a journal.

There's no special setup that need to be performed for this folder.  Simply start creating notes using a pre-defined naming convention to indicate the journal note type and the date range represented by the note.  All notes within this folder that adheres to the aforementioned naming convention will be seen and handled as part of the journal represented by the folder.

_Folder based journaling_ enables the user to maintain multiple arbitrary journals within the same vault as opposed to the model where only one folder within the vault is allocated for journal entries of a specific type.  This opens up a range of possibilities.  As an example, a project worked on for a client can have it's own journal which and then be used for reporting purposes for the client.

It should be noted that, as with the initial releases of this plugin, while the date format used within files (for titles, links etc.) are fully configurable as per the user's preference, the file name format is fixed.  The following journal note types are supported by the plugin:

| **Note type** | **Filename Format** | Example filename |
| ------------- | ------------------- | ---------------- |
| Daily note    | YYYY-MM-DD.md       | 2024-07-23.md    |
| Weekly note   | YYYY-[W]ww.md       | 2024-W30.md      |
| Monthly note  | YYYY-MM             | 2024-07.md       |
| Yearly note   | YYYY                | 2024.md          |

The following is a list of features that have been, or are planned to be implemented in this plugin...


---
## Feature: Journal header

The _journal header_ feature is a code block processor that renders an appropriate header in a journal file.  

### Examples
Examples of rendered headers for the different supported note types are as follows:

![](documents/attachments/Pasted%20image%2020240706102800.png)
<div style='text-align: right; font-style: italic'>Daily note</div>


![](documents/attachments/Pasted%20image%2020240706103524.png)
<div style='text-align: right; font-style: italic'>Weekly note</div>


![](documents/attachments/Pasted%20image%2020240706103917.png)
<div style='text-align: right; font-style: italic'>Monthly note</div>


![](documents/attachments/Pasted%20image%2020240706104024.png)
<div style='text-align: right; font-style: italic'>Yearly note</div>

### Using the Journal Header feature
To render a header in your journal note, simply add the following to the top of your note...

![](documents/attachments/Pasted%20image%2020240706111931.png)

Note that the header will render correctly without the `%%title%%` in the first line.   It is however recommended to include it for the following reason... If the `journal-header` code block is placed on the first line, whenever you open a document in edit mode, the cursor (which defaults to the first line in the file) will start off on the code block.  This results in the code block being rendered instead of the title until the user moves the cursor off it.  This behaviour can be a bit distracting.

By placing a comment on the first line, the cursor will fall on the comment when entering edit mode in stead of the header, providing a better user experienced.   However, when switching to _reading view_, the comment is omitted, resulting in the header being rendered right at the top of the document.

It is recommended to use the templating functionality provided by the __Templater__ plugin (available in the _Obsidian_ plugin store) to automatically add the above code block to new journal files.   _Templater_ can be configured to automatically add the code block to any new files created in the specified folders.

![](documents/attachments/Pasted%20image%2020240706113526.png)

Alternatively the _Obsidian_ core _Templates_ plugin can be used.
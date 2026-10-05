# Setting up the “Board Reminder” Shortcut

Quest Board can’t schedule notifications itself (web apps on iPad can’t), so when you choose
**Remind me** on a note it hands the reminder to Apple’s **Reminders** app through a Shortcut.
You set this Shortcut up **once**. It takes about five minutes.

## What the app sends

When you save a reminder, Quest Board opens this link:

```
shortcuts://run-shortcut?name=Board%20Reminder&input=text&text=<JSON>
```

The JSON looks like this:

```json
{"label": "Call the plumber", "due": "2026-10-06T17:30:00+05:30"}
```

- `label` is the short text from the reminder sheet. If you leave it empty, the app sends “Sticky note”.
- `due` is the date and time in ISO 8601 format, including your time-zone offset.

The Shortcut reads those two values and creates a reminder with an alert at that time.

---

## Step by step (on the iPad)

### 1. Create the Shortcut and name it exactly

1. Open the **Shortcuts** app.
2. On the **Shortcuts** tab, tap **+** (top right) to start a new shortcut.
3. Tap the name at the top of the editor (“New Shortcut”), choose **Rename**, and type
   **`Board Reminder`**. Spelling, capitals and the space must match exactly, or the app can’t find it.

### 2. Let it receive text

4. The top of the editor shows a grey line like **“Receive *Any* input from *Nowhere*”**.
   (If it isn’t there: tap the **ⓘ / Details** button, turn on **Show in Share Sheet**, then turn it
   off again. The grey line will now show.)
5. Tap **Any**, deselect everything except **Text**, and tap **Done**.
6. If the line also says **“If there’s no input: …”**, set it to **Stop and Respond** or **Continue**.
   Either works.

### 3. Read the JSON

7. Tap the search field at the bottom (“Search for apps and actions”), type **`dictionary`**, and add
   **Get Dictionary from Input**. Its input should read **Shortcut Input**. If it doesn’t, tap the blue
   field and choose **Shortcut Input**.

### 4. Pull out the label

8. Search for **`Get Dictionary Value`** and add it under the previous action.
   - It reads “Get **Value** for **Key** in **Dictionary**”.
   - Tap **Key** and type **`label`**.
   - The last field should be **Dictionary** (the output of step 7).
9. Search for **`Set Variable`**, add it, and name the variable **`Label`**. Its input should be
   **Dictionary Value**.

### 5. Pull out the due time

10. Add another **Get Dictionary Value**. Tap **Key** and type **`due`**. Make sure the
    last field is the **Dictionary** from step 7, not the Label. Tap it and pick **Dictionary** if needed.
11. Search for **`Get Dates from Input`** (it may be called **Get Dates from**) and add it. Its input
    should be the **Dictionary Value** from step 10.
12. Add **Set Variable** again and name it **`Due`**. Its input should be **Dates**.

### 6. Create the reminder

13. Search for **`Add New Reminder`** (in the Reminders actions) and add it.
    - Tap the title placeholder (“Reminder”), delete it, then tap **Variables** above the keyboard
      (or the variable bar) and insert **Label**.
    - Tap **Reminders** (the list) to choose which list it goes into, for example *Reminders* or *Today*.
    - Tap the arrow / **Show More** on the action. Set **Alert** to **At Time** and tap the date
      field. Choose **Select Variable**, then pick **Due**.
14. Optional: add a **Show Notification** action with the text “Reminder saved ✓” so you get a quick
    confirmation.

### 7. Allow access

15. Tap **Done**. The first time it runs, iPadOS asks for permission:
    - “Allow *Quest Board* to open *Shortcuts*?” → **Open** (iPadOS may ask this every time; that’s normal).
    - “Allow *Board Reminder* to access Reminders?” → **Allow** (or **Always Allow**).

The finished shortcut should read, top to bottom:

```
Receive Text input
Get Dictionary from  Shortcut Input
Get  Value  for  label  in  Dictionary
Set variable  Label  to  Dictionary Value
Get  Value  for  due  in  Dictionary
Get Dates from  Dictionary Value
Set variable  Due  to  Dates
Add  Label  to  Reminders   (Alert: At Time → Due)
```

---

## Test it

1. In Quest Board, long-press a note with your finger, choose **Remind me**, pick a time two
   minutes from now, write a label, and tap **Save reminder**.
2. Shortcuts opens and runs. Check the **Reminders** app: the reminder should be there with an alert.
3. To get back to the board, tap the **◀** back link in the top-left corner, or tap Quest Board in the Dock.

You can also test from inside the Shortcuts app: temporarily add a **Text** action at the very top
containing `{"label":"Test","due":"2026-10-06T17:30:00+05:30"}` (with your own date and offset), point
**Get Dictionary from** at that Text instead of Shortcut Input, run it, then undo the change.

## Troubleshooting

- **“Shortcut not found.”** The name must be exactly `Board Reminder`.
- **The reminder has no alert, or the wrong time.** Check that step 11 (**Get Dates from Input**) is
  there and that the Alert uses **Due**, not the raw Dictionary Value. If the time is off by hours, check
  the iPad’s time zone in Settings → General → Date & Time.
- **The title is empty or shows the whole JSON.** Make sure the title uses the **Label** variable and
  the step 8 key is lowercase `label`.
- **Nothing happens when saving.** iPadOS may be blocking the hand-off. Try again, and tap **Open** when
  it asks to open Shortcuts.

Removing a reminder pin from a note in Quest Board doesn’t delete the reminder in the Reminders app.
Delete it there too.

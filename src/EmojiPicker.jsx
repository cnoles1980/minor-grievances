import React, { useState } from "react";
const choices = [
  ["🙄", "Eye roll"], ["😤", "Frustrated"], ["🤦", "Facepalm"],
  ["😑", "Unamused"], ["🫠", "Melting"], ["💀", "Dead"],
  ["😭", "Crying"], ["😂", "Laughing"], ["🤬", "Swearing"],
  ["🖕", "Middle finger"], ["💩", "Poop"], ["🔥", "Fire"],
  ["☕", "Coffee"], ["🚗", "Car"], ["💻", "Computer"], ["📎", "Paperwork"],
];
export default function EmojiPicker({ onInsert, disabled }) {
  const [open, setOpen] = useState(false);
  return <div className="emoji-picker">
    <button type="button" disabled={disabled} aria-expanded={open} aria-controls="emoji-options" onClick={() => setOpen(!open)}>🙄 Add emoji</button>
    {open && <div id="emoji-options" className="emoji-options" role="group" aria-label="Choose an emoji">
      {choices.map(([emoji, label]) => <button type="button" key={label} aria-label={label} onClick={() => { onInsert(emoji); setOpen(false); }}>{emoji}</button>)}
    </div>}
  </div>;
}

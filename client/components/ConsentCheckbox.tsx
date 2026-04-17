import { useState } from "react";

interface ConsentCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export default function ConsentCheckbox({ checked, onChange }: ConsentCheckboxProps) {
  return (
    <label style={{
      display: "flex",
      alignItems: "flex-start",
      gap: 10,
      cursor: "pointer",
      fontSize: 13,
      color: "#8fa8c4",
      lineHeight: 1.5,
    }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{
          marginTop: 2,
          width: 16,
          height: 16,
          accentColor: "#c9a84c",
          flexShrink: 0,
          cursor: "pointer",
        }}
        required
      />
      <span>
        I agree to the{" "}
        <a
          href="/privacy-policy"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#c9a84c", textDecoration: "none" }}
          onClick={(e) => e.stopPropagation()}
        >
          Privacy Policy
        </a>
        {" "}and{" "}
        <a
          href="/terms"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#c9a84c", textDecoration: "none" }}
          onClick={(e) => e.stopPropagation()}
        >
          Terms &amp; Conditions
        </a>
        . I confirm I am 18 years of age or older.
      </span>
    </label>
  );
}
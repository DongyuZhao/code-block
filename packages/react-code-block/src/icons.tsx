type ClipIconProps = {
    done: boolean;
};

const iconProps = {
    "aria-hidden": true,
    fill: "none",
    focusable: "false",
    height: 18,
    stroke: "currentColor",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    viewBox: "0 0 24 24",
    width: 18
} as const;

export function ClipIcon({ done }: ClipIconProps) {
    return (
        <svg {...iconProps}>
            {done ? (
                <path d="m5 12 4 4L19 6" />
            ) : (
                <>
                    <rect height="13" rx="2" width="13" x="8" y="8" />
                    <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
                </>
            )}
        </svg>
    );
}

export function ShareIcon() {
    return (
        <svg {...iconProps}>
            <circle cx="18" cy="5" r="2.5" />
            <circle cx="6" cy="12" r="2.5" />
            <circle cx="18" cy="19" r="2.5" />
            <path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4" />
        </svg>
    );
}

export function MoreIcon() {
    return (
        <svg {...iconProps}>
            <circle cx="5" cy="12" fill="currentColor" r="1" stroke="none" />
            <circle cx="12" cy="12" fill="currentColor" r="1" stroke="none" />
            <circle cx="19" cy="12" fill="currentColor" r="1" stroke="none" />
        </svg>
    );
}

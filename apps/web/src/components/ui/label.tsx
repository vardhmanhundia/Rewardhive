import * as React from "react"

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={`text-sm font-medium leading-none cursor-pointer ${className || ""}`}
      {...props}
    />
  )
)
Label.displayName = "Label"

export { Label, type LabelProps }

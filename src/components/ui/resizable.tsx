"use client"

import React, { createContext, useContext, useRef, useState, MouseEvent, ReactNode } from "react"

const ResizableContext = createContext<{ columnSizes: number[], updateColumnSize: (index: number, size: number) => void }>({
  columnSizes: [],
  updateColumnSize: () => {},
})

interface ResizableProps {
  children: ReactNode
  columnCount: number
  defaultColumnSizes?: number[]
  className?: string
}

export function ResizableTable({ children, columnCount, defaultColumnSizes, className }: ResizableProps) {
  const [columnSizes, setColumnSizes] = useState<number[]>(
    defaultColumnSizes || Array(columnCount).fill(100 / columnCount)
  )

  const updateColumnSize = (index: number, size: number) => {
    setColumnSizes(prev => {
      const newSizes = [...prev]
      newSizes[index] = size
      return newSizes
    })
  }

  return (
    <ResizableContext.Provider value={{ columnSizes, updateColumnSize }}>
      <table className={`relative w-full border-collapse table-fixed ${className || ""}`}>
        {children}
      </table>
    </ResizableContext.Provider>
  )
}

interface ResizableHeaderProps {
  index: number
  children: ReactNode
  className?: string
}

export function ResizableHeader({ index, children, className }: ResizableHeaderProps) {
  const { columnSizes, updateColumnSize } = useContext(ResizableContext)
  const headerRef = useRef<HTMLTableCellElement>(null)
  const startXRef = useRef<number | null>(null)
  const startWidthRef = useRef<number | null>(null)
  const [isResizing, setIsResizing] = useState(false)

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    startXRef.current = e.clientX
    if (headerRef.current) {
      startWidthRef.current = headerRef.current.offsetWidth
    }
    setIsResizing(true)
    document.addEventListener("mousemove", handleMouseMove as any)
    document.addEventListener("mouseup", handleMouseUp as any)
  }

  const handleMouseMove = (e: globalThis.MouseEvent) => {
    if (!startXRef.current || !startWidthRef.current || !headerRef.current) return
    
    const parentWidth = headerRef.current.parentElement?.offsetWidth || 1
    const dx = e.clientX - startXRef.current
    const newWidth = Math.max(50, startWidthRef.current + dx)
    const newPercentage = (newWidth / parentWidth) * 100
    
    updateColumnSize(index, newPercentage)
  }

  const handleMouseUp = () => {
    startXRef.current = null
    startWidthRef.current = null
    setIsResizing(false)
    document.removeEventListener("mousemove", handleMouseMove as any)
    document.removeEventListener("mouseup", handleMouseUp as any)
  }

  return (
    <th
      ref={headerRef}
      className={`relative ${className || ""}`}
      style={{ width: `${columnSizes[index]}%` }}
    >
      <div className="flex items-center h-full px-2">{children}</div>
      <div
        className={`absolute right-0 top-0 h-full w-2 cursor-col-resize group hover:bg-gray-300 hover:opacity-50 ${
          isResizing ? "bg-gray-300 opacity-50" : ""
        }`}
        onMouseDown={handleMouseDown}
      >
        <div className="h-full w-[1px] mx-auto bg-gray-300 group-hover:bg-gray-600"></div>
      </div>
    </th>
  )
}

interface ResizableCellProps {
  index: number
  children: ReactNode
  className?: string
}

export function ResizableCell({ index, children, className }: ResizableCellProps) {
  const { columnSizes } = useContext(ResizableContext)
  
  return (
    <td
      className={`overflow-hidden ${className || ""}`}
      style={{ width: `${columnSizes[index]}%` }}
    >
      <div className="px-2 h-full flex items-center">{children}</div>
    </td>
  )
} 
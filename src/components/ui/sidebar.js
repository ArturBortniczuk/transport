'use client';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { usePathname } from 'next/navigation';

export const Sidebar = ({ children, open, setOpen }) => {
  return (
    <aside
      className={cn(
        "relative h-full w-16 transition-all duration-300 ease-in-out bg-blue-800 text-white",
        open && "w-64"
      )}
    >
      <div className="flex h-full flex-col">
        {/* Hamburger Menu Button */}
        <button
          onClick={() => setOpen(!open)}
          className="absolute -right-4 top-20 z-30 grid h-8 w-8 place-items-center rounded-full border border-neutral-200 bg-white text-blue-800 transition-all duration-300 ease-in-out hover:bg-neutral-100"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="16"
            height="16"
            className="transition-all duration-300 ease-in-out"
            style={{
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
            }}
          >
            <path
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d={open ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"}
            />
          </svg>
        </button>
        {children}
      </div>
    </aside>
  );
};

export const SidebarBody = ({ children, className }) => {
  return (
    <div
      className={cn(
        "flex h-full flex-1 flex-col px-3 py-8",
        className
      )}
    >
      {children}
    </div>
  );
};

export const SidebarLink = ({ link }) => {
  const pathname = usePathname();
  const isActive = pathname === link.href;

  return (
    <Link
      href={link.href}
      className={cn(
        "group flex w-full items-center gap-x-2 rounded-lg px-2.5 py-2 transition-all duration-150 ease-in-out hover:bg-blue-700",
        isActive ? "bg-blue-700" : ""
      )}
    >
      {link.icon}
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="whitespace-pre text-sm font-medium text-white"
      >
        {link.label}
      </motion.span>
    </Link>
  );
};

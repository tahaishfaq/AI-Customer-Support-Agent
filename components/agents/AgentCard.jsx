"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  FlaskConical,
  MoreHorizontal,
  Pencil,
  Rocket,
  Trash2,
} from "lucide-react";
import { DeleteAgentDialog } from "@/components/agents/DeleteAgentDialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function AgentStatusBadge({ agent, className }) {
  const disabled = agent?.enabled === false;
  const embedOff = !disabled && agent?.embedEnabled === false;

  if (disabled) {
    return (
      <Badge variant="destructive" className={className}>
        Disabled
      </Badge>
    );
  }

  if (embedOff) {
    return (
      <Badge variant="outline" className={className}>
        Embed off
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className={className}>
      Ready
    </Badge>
  );
}

function formatDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function IconLink({ href, label, children }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            href={href}
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={label}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function AgentCard({ agent, onDeleted, layout = "grid" }) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const list = layout === "list";
  const updated = formatDate(agent.updatedAt || agent.createdAt);

  return (
    <>
      <Card
        size="sm"
        className={cn(
          "h-full transition-colors hover:bg-muted/30 hover:ring-foreground/15",
          list &&
            "flex-row items-center gap-0 py-0 [--card-spacing:--spacing(4)]"
        )}
      >
        <CardHeader
          className={cn(
            list &&
              "flex-1 grid-cols-[1fr_auto] items-center gap-3 border-0 py-4"
          )}
        >
          <div className="min-w-0 flex flex-col gap-1.5">
            <div className="flex min-w-0 items-center gap-2">
              <CardTitle className="min-w-0 truncate font-heading text-base">
                <Link
                  href={`/agents/${agent.id}`}
                  className="hover:text-primary"
                >
                  {agent.name}
                </Link>
              </CardTitle>
              {list ? <AgentStatusBadge agent={agent} /> : null}
            </div>
            <CardDescription
              className={cn(!list && "line-clamp-2 min-h-10 text-[13px]")}
            >
              {agent.description || "No description yet"}
            </CardDescription>
            {list && updated ? (
              <p className="text-xs text-muted-foreground">
                Updated {updated}
              </p>
            ) : null}
          </div>

          {!list ? (
            <CardAction>
              <AgentStatusBadge agent={agent} />
            </CardAction>
          ) : null}
        </CardHeader>

        {!list ? (
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              {updated ? `Updated ${updated}` : "—"}
            </p>
          </CardContent>
        ) : null}

        <CardFooter
          className={cn(
            "gap-2 bg-transparent",
            list && "w-auto shrink-0 border-0 py-4"
          )}
        >
          <Link
            href={`/agents/${agent.id}`}
            className={cn(
              buttonVariants({ variant: "default", size: "sm" }),
              "gap-1.5"
            )}
          >
            Open
            <ArrowRight data-icon="inline-end" />
          </Link>
          <Link
            href={`/agents/${agent.id}/test`}
            className={cn(
              buttonVariants({ size: "sm" })
            )}
          >
            Test
          </Link>
          <div className="ml-auto flex items-center gap-0.5">
            <IconLink href={`/agents/${agent.id}/knowledge`} label="Knowledge">
              <BookOpen />
            </IconLink>
            <IconLink href={`/agents/${agent.id}/analytics`} label="Analytics">
              <BarChart3 />
            </IconLink>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="icon-sm" />}
                aria-label="More actions"
              >
                <MoreHorizontal />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-40">
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => router.push(`/agents/${agent.id}/test`)}
                  >
                    <FlaskConical />
                    Test
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() =>
                      router.push(`/agents/${agent.id}/customization`)
                    }
                  >
                    <Rocket />
                    Deploy
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => router.push(`/agents/${agent.id}/edit`)}
                  >
                    <Pencil />
                    Edit
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    variant="destructive"
                    className="cursor-pointer"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardFooter>
      </Card>

      <DeleteAgentDialog
        agent={agent}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={onDeleted}
      />
    </>
  );
}

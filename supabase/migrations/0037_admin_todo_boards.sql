-- Each admin board keeps its own to-do list: the TapAndLaunch board and the FitnessNav board.

alter table public.admin_todos
  add column board text not null default 'tapandlaunch' check (char_length(board) between 1 and 40);

create index admin_todos_board_idx on public.admin_todos (board);

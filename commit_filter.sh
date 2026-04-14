#!/bin/bash

# Read the commit message from stdin
COMMIT_MSG=$(cat)

# For date, to spread from March 9, 2024 to April 15, 2024
# 37 days, 312 commits, ~8 per day
# But to have 3-4 per week, perhaps set date to March 9 + (index % 37) days
# But to have index, use a counter
if [ ! -f /tmp/commit_counter ]; then
  echo 0 > /tmp/commit_counter
fi
INDEX=$(cat /tmp/commit_counter)
INDEX=$((INDEX + 1))
echo $INDEX > /tmp/commit_counter
DAY_OFFSET=$((INDEX % 37))
DATE_STR=$(date -j -v+${DAY_OFFSET}d -f "%Y-%m-%d" "2024-03-09" +"%Y-%m-%d %H:%M:%S")

# Assign author based on INDEX % 5
MOD=$((INDEX % 5))
if [ $MOD -eq 0 ]; then
  AUTHOR_NAME="Mohan Ganesh"
  AUTHOR_EMAIL="mohanganesh3@users.noreply.github.com"
elif [ $MOD -eq 1 ]; then
  AUTHOR_NAME="Sujal Bandi"
  AUTHOR_EMAIL="SujalBandi@users.noreply.github.com"
elif [ $MOD -eq 2 ]; then
  AUTHOR_NAME="Akshaya Aienavolu"
  AUTHOR_EMAIL="AkshayaAienavolu@users.noreply.github.com"
elif [ $MOD -eq 3 ]; then
  AUTHOR_NAME="Karthik Agisam"
  AUTHOR_EMAIL="karthik1agisam@users.noreply.github.com"
else
  AUTHOR_NAME="Mude Dinesh Naik"
  AUTHOR_EMAIL="MudeDineshNaik@users.noreply.github.com"
fi

echo "$COMMIT_MSG" | GIT_AUTHOR_NAME="Mohan Ganesh" GIT_AUTHOR_EMAIL="mohanganesh3@users.noreply.github.com" GIT_COMMITTER_NAME="Mohan Ganesh" GIT_COMMITTER_EMAIL="mohanganesh3@users.noreply.github.com" git commit-tree "$@"
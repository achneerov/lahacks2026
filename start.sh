#!/bin/bash

cd miniapp && npm install && npm run dev &
cd backend && npm install && npm run dev &

wait

# FROM node:17-bullseye
# 
# # RUN apt-get update && apt-get install -yq libgconf-2-4 gnupg gnupg1 gnupg2
# 
# # install chromium and node.js for arm
# run apt-get update && \
#   apt-get install -y \
#   chromium \
#   nodejs
# 
# COPY package.json .env chips ./
# 
# RUN npm install 
# 
# RUN npx playwright install 
# 
# COPY index.js ./
# 
# RUN npm start
# 
# 
# 
 FROM python:3.9.2-buster
 
 # Install Chromium and node.js for arm
 RUN apt-get update && \
     apt-get install -y \
     chromium \
     nodejs
 
 RUN mkdir /app
 WORKDIR /app

# Download playwright for linux x86_64
RUN wget https://files.pythonhosted.org/packages/b7/fd/a755971645836850765149e212ccc6a9756494ea438ac0a9efec4f5f9002/playwright-1.9.2-py3-none-manylinux1_x86_64.whl

# Rename it so that it can be installed on arm
RUN mv playwright-1.9.2-py3-none-manylinux1_x86_64.whl playwright-1.9.2-py3-none-any.whl

RUN pip install playwright-1.9.2-py3-none-any.whl

# replace the node binary provided by playwright with a symlink to the version we just installed.
RUN rm /usr/local/lib/python3.9/site-packages/playwright/driver/node && \
    ln -s /usr/bin/node /usr/local/lib/python3.9/site-packages/playwright/driver/node

# create the hierarchy expected by playwright to find chrome
RUN mkdir -p /app/pw-browser/chromium-854489/chrome-linux
# Add a symlink to the chromium binary we just installed.
RUN ln -s /usr/bin/chromium /app/pw-browser/chromium-854489/chrome-linux/chrome
# ask playwright to search chrome in this folder
ENV PLAYWRIGHT_BROWSERS_PATH=/app/pw-browser

# Copy the test file
COPY test_playwright.py /app/test_playwright.py

CMD [ "python3.9", "test_playwright.py" ]

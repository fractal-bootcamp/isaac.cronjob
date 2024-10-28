#!/bin/bash

# This script automates the deployment of files to an EC2 instance for a Node.js project.
# To automate the deployment on a schedule, consider setting up a cron job using `crontab -e`
# and specifying the desired schedule for running this script.

# Load environment variables
source .env

# Check if required environment variables are set
if [ -z "$EC2_HOST" ]; then
    echo "Error: EC2_HOST not set in .env"
    exit 1
fi

if [ -z "$EC2_KEY_PATH" ]; then
    echo "Error: EC2_KEY_PATH not set in .env"
    exit 1
fi

if [ -z "$EC2_USER" ]; then
    echo "Error: EC2_USER not set in .env (usually 'ec2-user')"
    exit 1
fi

# Define the remote directory where files will be deployed
REMOTE_DIR="/home/$EC2_USER/github-activity-emailer"

# Create a temporary directory for the files to transfer
TEMP_DIR=$(mktemp -d)
echo "Created temporary directory: $TEMP_DIR"

# Copy required files to temporary directory
cp package.json package-lock.json sendEmail.js .env "$TEMP_DIR/"

# Create the remote directory and transfer files
echo "Creating remote directory and transferring files..."
ssh -i "$EC2_KEY_PATH" "$EC2_USER@$EC2_HOST" "mkdir -p $REMOTE_DIR"
scp -i "$EC2_KEY_PATH" -r "$TEMP_DIR"/* "$EC2_USER@$EC2_HOST:$REMOTE_DIR/"

# Install Node.js and npm if not already installed
echo "Setting up Node.js environment..."
ssh -i "$EC2_KEY_PATH" "$EC2_USER@$EC2_HOST" "
    # Update system packages
    sudo yum update -y

    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        echo 'Installing Node.js...'
        curl -sL https://rpm.nodesource.com/setup_18.x | sudo bash -
        sudo yum install -y nodejs
    fi

    # Check if npm is installed
    if ! command -v npm &> /dev/null; then
        echo 'Installing npm...'
        sudo yum install -y npm
    fi

    # Navigate to project directory
    cd $REMOTE_DIR

    # Install project dependencies
    npm install
"

# Clean up temporary directory
rm -rf "$TEMP_DIR"
echo "Cleaned up temporary directory"

# Verify deployment
echo "Verifying deployment..."
ssh -i "$EC2_KEY_PATH" "$EC2_USER@$EC2_HOST" "
    cd $REMOTE_DIR
    if [ -f sendEmail.js ] && [ -f package.json ]; then
        echo 'Deployment successful!'
        echo 'Installed Node.js version:'
        node --version
        echo 'Installed npm version:'
        npm --version
        echo 'Project files:'
        ls -la
    else
        echo 'Deployment verification failed!'
        exit 1
    fi
"

echo "Deployment complete!"

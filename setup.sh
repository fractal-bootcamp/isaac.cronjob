#!/bin/bash
# This is a setup script for basic EC2 stuff and cron jobs on EC2

echo "Installing 'cronie' package..."
sudo yum install -y cronie

echo "Enabling 'cronie' service..."
sudo systemctl enable crond.service

echo "Starting 'cronie' service..."
sudo systemctl start crond.service

echo "Verifying the 'cronie' service status..."
service_status=$(sudo systemctl is-active crond.service)

if [ "$service_status" == "active" ]; then
    echo "'cronie' service is active and running."
else
    echo "There was an issue starting the 'cronie' service. Please check manually."
fi

echo "Displaying 'cronie' service status..."
sudo systemctl status crond.service | grep Active

echo "Setup complete."

# After this, try running crontab -e and it should work

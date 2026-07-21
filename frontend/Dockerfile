# Production stage - serve with nginx
FROM nginx:alpine

# Copy built files from local dist folder (pre-built on curacao)
COPY frontend/dist /usr/share/nginx/html

# Copy nginx configuration
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

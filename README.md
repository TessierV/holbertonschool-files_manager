![Guillaume, CTO at Holberton School (2)](https://github.com/yunusemretokyay1/holbertonschool-files_manager/assets/113889290/de52f198-bf3e-4875-b419-65b612a62e5a)
<a href="https://git.io/typing-svg"><img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=700&size=44&pause=1000&color=CD3544&center=true&vCenter=true&width=935&height=60&lines=FILE+MANAGER" alt="Typing SVG" /></a><br>
<br>

## Overview
This is a simple file manager application built with Node.js, Express, MongoDB, and Redis.

<br>

## Table of Content
* [Features](#Features)
* [Installation](#Installation)
* [API Endpoints](#API)
* [Technologies Used](#Technologies)
* [Students](#Students)
<br>

## Features

- User authentication: Users can sign up and log in securely.
- File management: Users can upload, view, and manage their files.
- File sharing: Users can choose to share files publicly or keep them private.
- Statistics: Provides statistics on the number of users and files in the system.
- Status monitoring: Allows checking the status of the application components (MongoDB, Redis).
<br>

## Installation

1. Clone the repository:
``git clone https://token@github.com/yunusemretokyay1/file-manager-app.git``

2. Install dependencies:
``npm install``
``npm install Node / Express / Mongodb / Redis / Bull``

3. Setup Envrionment:
``PORT=5000
DB_HOST=localhost
DB_PORT=27017
DB_DATABASE=files_manager``

4. Compile:
``npm run start-server``
``redis-server``
``mongod``
<br>

## API Endpoints

- **POST /users**: Create a new user.
- **GET /users/me**: Get user information.
- **POST /files**: Upload a new file.
- **GET /files/:id**: Get information about a file.
- **GET /files**: Get a list of files.
- **PUT /files/:id/publish**: Publish a file.
- **PUT /files/:id/unpublish**: Unpublish a file.
- **GET /files/:id/data**: Get file data.
- **GET /status**: Check the status of the application components.
- **GET /stats**: Get statistics on users and files.
<br>

## Technologies Used

- Node.js
- Express
- MongoDB
- Redis
<br>

## Test

* Test File 1 for exercices 0: Redis utils
* Test File 2 for exercices 1: MongoDB utils
* Test File 3 for exercices 5: First file

<br>
<h3>Students :
    <a href="https://www.linkedin.com/in/yunusemretokyay/">
       <img alt="Anurag Hazra | CodeSandbox" height="20px" src="https://img.shields.io/badge/YunusEmreTokyay-4A6552?style=for-the-badge&logo=linkedin&color=CD3544&logoColor=white" />
    </a>
    <a href="https://www.linkedin.com/in/vanessa-tessier-601794252/">
        <img alt="Anurag Hazra | CodeSandbox" height="20px" src="https://img.shields.io/badge/TessierVanessa-4A6552?style=for-the-badge&logo=linkedin&color=CD3544&logoColor=white"/>
    </a>
    </h3>

<hr>
<p align="right">Holberton School - TOULOUSE Cohort C20 Spe Fullstack Avril 2024</p>



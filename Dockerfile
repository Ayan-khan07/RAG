
# Stage 1: Build application
FROM maven:3.10.2-eclipse-temurin-25 AS build

WORKDIR /app

COPY pom.xml .
COPY src ./src

RUN mvn -B -DskipTests clean package

# Stage 2: Run application
FROM eclipse-temurin:25-jre

WORKDIR /app

COPY --from=build /app/target/Pdf-0.0.1-SNAPSHOT.jar app.jar

EXPOSE 10000

ENTRYPOINT ["java", "-jar", "app.jar"]

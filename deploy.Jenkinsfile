/*
  catatan untuk menggunakan pipeline ini adalah:
  - nama branch harus sudah sesuai standar yaitu development, qa dan Production
*/
@Library("kai-jenkins-lib") _

/* 'nama-key-di-vault': 'output/lokasi/file/disimpan' */
def vault_mapping = [
    '.env': '.env',
]

/* kalo mau pake common-file di uncomment saja */
def vault_common = [
    'zz-custom-php.ini': 'zz-custom-php.ini',
    'supervisord-laravel-nonroot.conf': 'supervisord.conf',
    'Caddyfile-hardened-v2': 'Caddyfile',
]

pipeline {
    agent {
        node {
            label 'agent2767'
        }
    }

    environment {
        /* Perlu diganti secara manual. */
        APP_NAME = 'qrku'
        STREAM = 'IT'

        /* system information */
        WEBSERVER = 'Caddy'
        FRAMEWORK = 'Laravel'
        LANGUAGE = 'PHP'
    }

    // manual parameter
    // parameters {
    //     string(name: 'TAG', defaultValue: 'alpha.0.0.0', description: 'TAG for version (opsional)')
    // }

    // Stages
    stages {
        stage('Populate Environment Variable') {
            steps {
                script {
                    setup.populate_env_okd_bdx()
                }
            }
        }

        stage('Setup Git Parameter') {
            steps {
                script {
                    setup.set_git_parameter()
                }
            }
        }

        /* mirror to git.kai.id */
        stage('Git Push to Gitlab KAI') {
            when {
                expression {
                    return env.ENV == 'DEV'
                }
            }
            steps {
                script {
                    setup.push_to_gitkai()
                }
            }
        }

        stage('Static Code Analysis with Sonarqube') {
            when {
                expression {
                    return env.ENV == 'DEV'
                }
            }
            steps {
                script {
                    setup.scan_with_sonarqube(language: LANGUAGE)
                }
            }
        }

        // Push image to KAI registry
        stage('Build & Push Image') {
            steps {
                script {
                    /* kalo nama filenya dinamis kaya config asp dotnet bisa dilakukan begini */
                    // switch (env.VER) {
                    // case 'alpha':
                    //         env.ENV_ASP = 'Development'
                    //         break
                    // case 'beta':
                    //         env.ENV_ASP = 'QA'
                    //         break
                    // case 'live':
                    //         env.ENV_ASP = 'Production'
                    //         break
                    // }
                    //
                    // /* 'nama-key-di-vault': 'output/lokasi/file/disimpan' */
                    // def vault_mapping = [
                    //     "appsettings.${ENV_ASP}.json": "appsettings.${ENV_ASP}.json",
                    // ]

                    setup.get_config_from_map(vault_map: vault_mapping)
                    setup.get_config_from_map(vault_map: vault_common, vault_dir: "config/${ENV}/common-file")
                    k8s.build_image_and_push(docker_arg: "", dockerfile: "Dockerfile")
                }
            }
        }

        // Update manifest to trigger RKE for deployment
        stage('Update Manifest') {
            steps {
                script {
                    k8s.update_manifest()
                }
            }
        }

        /*
        stage('Ask for deploy confirmation in prod') {
            when {
                expression {
                    return env.ENV == 'Production'
                }
            }
            steps {
                input("Lanjut deploy ke PRODUCTION???")
            }
        }
        */

        // Deploy
        stage('Deploy App') {
            steps {
                script {
                    k8s.deploy_app()
                }
            }
        }

    }

    post {
        always {
            script {
                post.defaultAlways()
            }
            //cleanWs() // uncomment barangkali file lama membuat docker buildnya error
        }
        success {
            script {
                post.defaultSuccess()
            }
        }
        unstable {
            script {
                post.defaultUnstable()
            }
        }
        failure {
            script {
                post.defaultFailure()
            }
        }
        changed {
            script {
                post.defaultChanged()
            }
        }
    }
}


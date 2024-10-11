---
layout: post
title: Provisioning a Local Kubernetes Cluster with Ansible and Vagrant
description: This post explains how to set up a local Kubernetes cluster using Ansible and Vagrant.
summary: A guide to provisioning a local Kubernetes cluster using Ansible and Vagrant.
tags: [kubernetes, ansible, vagrant]
---

In this post, I'll walk you through setting up a local Kubernetes cluster using two powerful tools: Ansible and Vagrant. Both tools are widely used in DevOps workflows to automate infrastructure management; each serves a unique purpose in this setup.

# Vagrant

[Vagrant](https://www.vagrantup.com/) is a tool for managing virtual environments. It wraps virtualization providers like VirtualBox and others, making creating and managing consistent development environments easy. By writing a configuration file (called a _Vagrantfile_), you can define the resources you need, like virtual machines (VMs), here referred to as nodes.

For our local Kubernetes cluster, Vagrant's key advantage is that it simplifies and standardizes creating and managing multiple nodes (such as the master and worker nodes). It ensures that each node is provisioned with consistent specifications, like the correct amount of memory, CPU, and networking configuration.

# Ansible

[Ansible](https://www.ansible.com/) is an automation tool focusing on configuration management, application deployment, and infrastructure orchestration. It configures and manages machines using _playbooks_ — simple YAML files describing tasks. What makes Ansible particularly useful is that it's agentless. Unlike some other configuration management tools, Ansible doesn't require software agents to be installed on the target machines. Instead, it uses SSH to execute tasks remotely (although there are also other [connection methods](https://docs.ansible.com/ansible/latest/inventory_guide/connection_details.html)).

In setting up our local Kubernetes cluster, Ansible automates the installation of required software (like Docker, kubeadm, kubectl, and Kubernetes networking components) across all nodes in the cluster. Rather than manually installing and configuring each node, you can define these steps in a playbook, which ensures that the entire cluster is configured uniformly.

# Why use Vagrant and Ansible together?

Combining Vagrant and Ansible brings the best of both worlds: Vagrant is great for managing virtual machines. At the same time, Ansible is ideal for automating the configuration of those VMs. Here's how they complement each other:

- Vagrant creates the nodes (master and worker nodes) that act as your Kubernetes cluster.
- Ansible then configures those nodes, installing Kubernetes and setting up the cluster automatically.

Combined, this looks as follows:

<p align="center">
<img width="400px" alt="Ansible, Vagrant and Kubernetes" src="/assets/images/posts/ansible-vagrant.jpg" />
</p>

1. Vagrant is used to create/provision nodes.
2. Ansible is used to push the Kubernetes configuration to all created nodes.

All nodes together participate in a private network.

# Why not Minikube?

One of the main limitations of Minikube is that it runs Kubernetes in a single-node configuration (both master and worker processes on the same machine). While this is fine for basic testing, it doesn't fully simulate a real-world production environment. It typically involves multiple nodes (one or more master nodes and several worker nodes).

Using Vagrant and Ansible, you can create an actual multi-node cluster with separate master and worker nodes. This provides a closer approximation to how Kubernetes runs in production.

Moreover, an Ansible configuration can typically be easily carried over to a real cluster.

# Vagrantfile

A Vagrantfile (written in Ruby) serves as a configuration file for Vagrant, facilitating the creation and management of virtualized development environments. In this specific Vagrantfile, a Kubernetes cluster is established with one master node and two worker nodes, all running on Ubuntu 22.04 using a base _box_ from [Bento](https://portal.cloud.hashicorp.com/vagrant/discover/bento). A box is a pre-configured base image used to provision a node (virtual machine) in Vagrant.

Each virtual machine is configured with a unique private IP address alongside allocated CPU and memory resources. The master node is set up with port forwarding to enable Kubernetes API access on port 6443. Ansible is employed directly from within Vagrant for provisioning, executing a predefined playbook to configure Kubernetes on each node using the [Ansible Provisioner](https://developer.hashicorp.com/vagrant/docs/provisioning/ansible).

Let's proceed with the section of the Vagrantfile that configures the master:

{% highlight ruby %}
{% raw %}
LINUX_BASE_BOX = "bento/ubuntu-22.04"

Vagrant.configure("2") do |config|

    # Configuration for the "master" VM
    config.vm.define "master" do |master|
        # Define a static IP for the master VM
        ip = "10.10.2.10"

        # Set the base box for the master VM
        master.vm.box = LINUX_BASE_BOX

        # Set the hostname for the master VM
        master.vm.hostname = "master"

        # Configure a private network with the defined IP
        master.vm.network "private_network", ip: ip

        # Forward port 6443 from the guest (VM) to the host machine, for Kubernetes API access
        master.vm.network "forwarded_port", guest: 6443, host: 6443

        # Configure the master VM's provider (VirtualBox in this case)
        master.vm.provider "virtualbox" do |virtualbox|
            # Customize the VM settings
            virtualbox.customize ["modifyvm", :id, "--cableconnected1", "on", "--audio", "none"]

            # Set the memory to 2048 MB (2 GB)
            virtualbox.memory = "2048"

            # Allocate 2 CPUs to the master VM
            virtualbox.cpus = "2"
        end

        # Provision the master VM using Ansible to run the specified playbook
        master.vm.provision "ansible" do |ansible|
            # Specify the Ansible playbook file for Kubernetes setup
            ansible.playbook = "./ansible/kubernetes.yml"

            # Pass the master node's IP address as an extra variable to the playbook
            ansible.extra_vars = {
                node_ip: ip,
            }
        end
    end
{% endraw %}
{% endhighlight %}

Similarly, two additional worked nodes are set up:

{% highlight ruby %}
{% raw %}
    # Loop to configure 2 node VMs (node1 and node2)
    1.upto(2) do |n|

        # Configuration for each node VM
        config.vm.define "node#{n}" do |node|
            ip = "10.10.2.%d" % [20 + n]

            node.vm.box = LINUX_BASE_BOX
            node.vm.hostname = "node#{n}"
            node.vm.network "private_network", ip: ip

            node.vm.provider "virtualbox" do |virtualbox|
                virtualbox.customize ["modifyvm", :id, "--cableconnected1", "on", "--audio", "none"]
                virtualbox.memory = "2048"
                virtualbox.cpus = "2"
            end

            node.vm.provision "ansible" do |ansible|
                ansible.playbook = "./ansible/kubernetes.yml"
                ansible.extra_vars = {
                    node_ip: ip,
                }
            end
        end
    end
end
{% endraw %}
{% endhighlight %}

The configuration file is saved in a file named _Vagrantfile_. What is important to note is the port forwarding of the master node's port 6443, which will allow us to remotely control the Kubernetes cluster from the host machine.

# The Ansible configuration

Next, we will use various Ansible configuration files to set up the Kubernetes cluster across the nodes. A [_playbook_](https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_intro.html), written in YAML, provides the instructions for configuring either individual nodes or groups of nodes. The primary playbook, referenced in the `Vagrantfile` above, will be located at _ansible/kubernetes.yml_ and will utilize the `kubernetes` role.

In Ansible, a role is a structured collection of tasks, variables, files, and templates, designed to efficiently organize and automate node configuration. Below is a description of the playbook:

{% highlight yaml %}
{% raw %}
- hosts: all        # Target all nodes for this playbook
  gather_facts: yes # Collect detailed system facts from each node
  roles: 
    - kubernetes    # Apply the 'kubernetes' role to configure the nodes
{% endraw %}
{% endhighlight %}

## The main playbook

Next, we have the main task file located at _ansible/roles/kubernetes/main.yml_, which contains the instructions executed on the nodes:

{% highlight yaml %}
{% raw %}
- import_tasks: set_timezone.yml        # Set timezone on each node
  become: yes                           # Execute with elevated (root) privileges

- import_tasks: install_kubernetes.yml  # Install Kubernetes components
  become: yes                           # Requires root access to install packages

- import_tasks: configure_master.yml    # Configure the Kubernetes master node
  when: inventory_hostname == "master"  # Only run this task on the node designated as "master"

- import_tasks: configure_node.yml      # Configure worker nodes
  become: yes                           # Needs elevated permissions
  when: inventory_hostname != "master"  # Run this task on all nodes except the master
{% endraw %}
{% endhighlight %}

This task file primarily imports specific task sets, but there are key elements worth noting:

- `become: yes` specifies that tasks should run with elevated privileges (typically as root).
- Conditional statements such as `when: inventory_hostname == "master"` and `when: inventory_hostname != "master"` ensure that tasks are appropriately executed for either the master node or the worker nodes. The `inventory_hostname` variable refers to each node's hostname as defined in the Vagrantfile.

The concept of [_inventory_](https://docs.ansible.com/ansible/latest/getting_started/get_started_inventory.html) in Ansible refers to the organization of nodes. In this case, Vagrant conveniently automatically handles the creation of the Ansible inventory.

## Setting the timezone

Next, we proceed with executing each group of tasks as imported above, starting with setting the system timezone consistently across all nodes:

{% highlight yaml %}
{% raw %}
- name: Set system timezone to local time
  file:
    src: "/usr/share/zoneinfo/{{ local_time_zone }}"  # Source timezone file based on the local_time_zone variable
    dest: "/etc/localtime"                            # Set the system's timezone by linking to this destination
    state: link                                       # Create a symbolic link to the timezone file
    force: yes                                        # Overwrite the existing link if it already exists
{% endraw %}
{% endhighlight %}

In this task, the variable `local_time_zone` is used to specify the desired timezone. This variable is defined in the default variable file, located at _ansible/roles/defaults/main.yml_:

{% highlight yaml %}
{% raw %}
local_time_zone: "Europe/Amsterdam"  # Default timezone for the nodes
local_network: 10.10.0.0/16          # Default network configuration
{% endraw %}
{% endhighlight %}

The `local_time_zone` variable allows for easy customization of the timezone, while keeping configuration flexible and consistent across all nodes. These default values can be customized for different environments or regions and can also be overridden as needed.

## Installing Kubernetes

Next, we move on to the `_ansible/roles/tasks/install_kubernetes.yml_` file, which handles the generic installation and configuration of Kubernetes. These tasks apply to both the master and worker nodes:

{% highlight yaml %}
{% raw %}
- name: Update apt cache and install required packages
  ansible.builtin.apt:
    update_cache: yes
    state: present
    pkg:
      - apt-transport-https
      - ca-certificates
      - curl
      - gpg
      - firewalld  # Firewall management package

- name: Create directory for apt keyrings
  ansible.builtin.file:
    path: /etc/apt/keyrings
    state: directory
    mode: '0755'  # Set directory permissions

- name: Download Kubernetes apt key
  ansible.builtin.get_url:
    url: https://pkgs.k8s.io/core:/stable:/v1.29/deb/Release.key
    dest: /etc/apt/keyrings/kubernetes-apt-keyring.key
    mode: '0644'  # Set file permissions
    force: true

- name: Extract GPG keys with dearmor
  ansible.builtin.command:
    cmd: "gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg /etc/apt/keyrings/kubernetes-apt-keyring.key"
    creates: "/etc/apt/keyrings/kubernetes-apt-keyring.gpg"  # Only run if the .gpg file doesn't already exist

- name: Add Kubernetes repository to apt sources list
  ansible.builtin.apt_repository:
    filename: kubernetes
    repo: 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.29/deb/ /'

- name: Install Kubernetes and containerd packages
  ansible.builtin.apt:
    update_cache: yes
    state: present
    pkg:
      - kubelet
      - kubeadm
      - kubectl
      - containerd

- name: Create directory for containerd config if not exists
  ansible.builtin.file:
    path: "/etc/containerd/"
    state: directory

- name: Generate default containerd configuration
  ansible.builtin.command: containerd config default
  register: containerd_config  # Store the output in a variable

- name: Save containerd config to file
  ansible.builtin.template:
    src: "config_template.j2"  # Template file to use
    dest: /etc/containerd/config.toml
    mode: '0644'  # Set file permissions

- name: Modify containerd config to enable SystemdCgroup
  ansible.builtin.replace:
    path: "/etc/containerd/config.toml"
    regexp: 'SystemdCgroup\s*=.*$'  # Find the SystemdCgroup line
    replace: 'SystemdCgroup = true'  # Replace it with the correct value

- name: Restart containerd to apply changes
  ansible.builtin.systemd:
    state: restarted
    daemon_reload: true
    name: containerd

- name: Load br_netfilter kernel module
  community.general.modprobe:
    name: br_netfilter  # Required for networking between containers

- name: Enable IPv4 forwarding
  ansible.posix.sysctl:
    name: net.ipv4.ip_forward
    value: 1
    sysctl_set: yes

- name: Disable swap for current session
  ansible.builtin.command: swapoff -a

- name: Add cron job to disable swap on reboot
  ansible.builtin.cron:
    name: "disable swap"
    special_time: reboot
    job: "/sbin/swapoff -a"

- name: Restart and enable kubelet
  ansible.builtin.systemd:
    state: restarted
    daemon_reload: true
    name: kubelet
    enabled: true

- name: Allow traffic on Kubernetes API port (6443)
  ansible.posix.firewalld:
    port: 6443/tcp
    zone: public
    state: enabled
    permanent: true

- name: Allow traffic on Kubelet port (10250)
  ansible.posix.firewalld:
    port: 10250/tcp
    zone: public
    state: enabled
    permanent: true

- name: Allow traffic on local network
  ansible.posix.firewalld:
    source: "{{ local_network }}"  # Using the predefined local network variable
    zone: trusted
    state: enabled
    permanent: true

- name: Reload firewalld to apply changes
  ansible.builtin.service:
    name: firewalld
    state: reloaded
{% endraw %}
{% endhighlight %}

Note the usage of Ansible modules such as `ansible.builtin.service`, which is a built-in module offering common tasks. Many modules are already built in to Ansible, as can be observed [here](https://docs.ansible.com/ansible/latest/collections/ansible/builtin/). These modules provides an easy way of configuring nodes, while also ensuring other essential features such as platform-independence.

This set of tasks accomplishes the following:

1. Install all necessary packages required for Kubernetes installation and configuration.
2. Install essential Kubernetes components (`kubelet`, `kubeadm`, `kubectl`).
3. Configure the container runtime `containerd` with the appropriate settings.
4. Enable bridge network filtering (`br_netfilter`), which is required for Kubernetes pod networking.
5. Enable IP packet forwarding to allow proper routing and communication between containers.
6. Disable system swap, which is a requirement for Kubernetes to function correctly.
7. Ensure `kubelet` (the Kubernetes node agent) is enabled and running.
8. Configure the firewall to allow necessary traffic on key Kubernetes ports (e.g., `6443`, `10250`).

A template file _ansible/roles/kubernetes/templates/config_template.j2_ is used for the configuration of containerd:

{% highlight conf %}
{% raw %}
{{ containerd_config.stdout | replace('\\n', '\n') }}
{% endraw %}
{% endhighlight %}

## Configuring the master node

Next, we move on to the set of tasks that configure the Kubernetes master node in _ansible/roles/kubernetes/tasks/configure_master.yml_:

{% highlight yaml %}
{% raw %}
- name: Install pip (Python package manager)
  become: yes
  ansible.builtin.apt:
    name: python3-pip
    state: present

- name: Install the Ansible Python package
  ansible.builtin.pip:
    name: ansible

- name: Install the Kubernetes Python package
  ansible.builtin.pip:
    name: kubernetes

- name: Initialize the Kubernetes cluster
  become: yes
  ansible.builtin.shell: "kubeadm init --apiserver-advertise-address={{ node_ip }} --pod-network-cidr=10.244.0.0/16"
  # Initializes the Kubernetes control plane and advertises the master node’s IP

- name: Create the .kube directory
  ansible.builtin.file:
    path: "{{ ansible_env.HOME }}/.kube"
    state: directory
    mode: '0755'
  # Ensures the .kube directory exists in the current user's home directory

- name: Copy kubeconfig to user's home directory
  become: yes
  ansible.builtin.copy:
    src: /etc/kubernetes/admin.conf
    dest: "{{ ansible_env.HOME }}/.kube/config"
    remote_src: yes
  # Copies the admin kubeconfig file for cluster access

- name: Set ownership of .kube/config to the current user
  ansible.builtin.file:
    path: "{{ ansible_env.HOME }}/.kube/config"
    owner: "{{ ansible_env.USER }}"
    group: "{{ ansible_env.USER }}"
    mode: '0644'
  become: true
  # Adjusts file permissions so the current user can access the Kubernetes configuration

- name: Download the Flannel network plugin configuration
  ansible.builtin.get_url:
    url: https://github.com/flannel-io/flannel/releases/latest/download/kube-flannel.yml
    dest: /tmp/kube-flannel.yml
    mode: '0644'
    force: true
  # Downloads the latest version of Flannel, a network plugin for Kubernetes

- name: Apply the Flannel network plugin to the cluster
  kubernetes.core.k8s:
    state: present
    src: /tmp/kube-flannel.yml
  # Deploys the Flannel network plugin to enable pod networking

- name: Generate the join command for worker nodes
  shell: "kubeadm token create --print-join-command"
  register: join_command
  # Retrieves the command that worker nodes will use to join the cluster

- name: Save the join command to a local file
  local_action: copy content="{{ join_command.stdout_lines[0] }}" dest="./join-command"
  # Stores the join command locally for use in the worker node setup
{% endraw %}
{% endhighlight %}

In this section, we utilize the [`ansible_env`](https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_environment.html) variable to retrieve the current user’s home directory and username dynamically. This is especially useful for creating the necessary `.kube` directory and managing file ownership. The final task stores the join command, generated in the previous step, in a file called `./join-command`. This command will be used later when configuring worker nodes to join the cluster.

This set of tasks performs the following operations:

1. Install all required dependencies, including Python packages for Ansible and Kubernetes.
2. Initialize the Kubernetes master node, using the `node_ip` variable (passed from the Vagrantfile) as the advertise address.
3. Create the `~/.kube` directory and copy the Kubernetes configuration file (`kubeconfig`) to the user’s home directory.
4. Download and apply the [Flannel network plugin](https://github.com/flannel-io/flannel) for pod networking.
5. Generate a join token for worker nodes to connect to the cluster.
6. Save the join command to a file for later use in configuring the worker nodes.

## Configuring the worker node

The following set of tasks is used to configure the worker node and join it to the Kubernetes cluster in _ansible/roles/kubernetes/tasks/configure_node.yml_:

{% highlight yaml %}
{% raw %}
- name: Allow Flannel network through the firewall
  ansible.posix.firewalld:
    zone: trusted
    interface: flannel.1
    permanent: true
    state: enabled

- name: Reload the firewall to apply changes
  ansible.builtin.service:
    name: firewalld
    state: reloaded

- name: Copy the join command to the worker node
  ansible.builtin.copy:
    src: join-command
    dest: /tmp/join-command.sh
    mode: '0777'

- name: Join the worker node to the Kubernetes cluster
  ansible.builtin.command: sh /tmp/join-command.sh
{% endraw %}
{% endhighlight %}

This set of tasks accomplishes the following:

1. Configure the firewall to allow the Flannel network interface, ensuring correct network communication.
2. Copy the Kubernetes join command to the worker node.
3. Execute the join command to add the worker node to the Kubernetes cluster.

# Provisioning with Vagrant

With the Vagrant and Ansible configurations in place, we can now proceed to provision the master and worker nodes. This can be done by running the `vagrant up` command in the directory where the `Vagrantfile` is located. This command will create and configure the nodes as defined in the configuration. 

Once provisioning is complete, you can check the status of the nodes using the `vagrant status` command, which should display output similar to the following:

{% raw %}
```
Current machine states:

master                    running (virtualbox)
node1                     running (virtualbox)
node2                     running (virtualbox)

This environment represents multiple VMs. The VMs are all listed
above with their current state. For more information about a specific
VM, run `vagrant status NAME`.
```
{% endraw %}

For more Vagrant commands, refer to the [documentation](https://developer.hashicorp.com/vagrant/docs/cli).

# Verifying the Kubernetes cluster

After provisioning, the Kubernetes cluster should be running. You can verify this by connecting to the master node via SSH using `vagrant ssh master`. Then, use `kubectl get nodes` to check the status of the nodes. This should show output similar to:

{% raw %}
```
NAME     STATUS   ROLES           AGE     VERSION
master   Ready    control-plane   5h56m   v1.29.9
node1    Ready    <none>          5h55m   v1.29.9
node2    Ready    <none>          5h54m   v1.29.9
```
{% endraw %}

# Accessing the Kubernetes cluster from the host machine

Instead of accessing the master node via SSH every time to interact with the Kubernetes cluster, you can copy the _~/.kube/config_ file from the master node to your host machine. This allows you to manage the cluster from the host machine.

Since we have forwarded the master node's API server port to the host machine (port 6443), you can access the Kubernetes cluster directly from your host.

# Lastly

Thanks to [Stefan Pedratscher](https://github.com/stefanpedratscher) for contributing to this post.

Enjoy.
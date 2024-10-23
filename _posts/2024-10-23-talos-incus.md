---
layout: post
title: Provisioning a Local Kubernetes Cluster with Incus and Talos
description:
summary:
tags: [incus, talos, kubernetes, qemu]
---

Incus is a versatile tool for managing containers with LXC and virtual machines (VMs) using QEMU. It offers a fast and efficient way to create VMs. Forked from LXD, Incus provides a powerful alternative to traditional virtualization platforms like VirtualBox. Using KVM for hardware-accelerated virtualization via QEMU, Incus enables rapid VM deployment, which is ideal for scenarios requiring multiple instances.

This guide will walk you through setting up VMs with Incus on Arch Linux, configuring the firewall, installing Talos, and spinning up a Kubernetes cluster.

# Prerequisites

This guide assumes you're using Arch Linux as the host operating system. Make sure the following are installed and properly configured:

- **Incus:** A container and VM management tool. Learn more about Incus [here](https://linuxcontainers.org/incus/introduction/).
- **firewalld:** The firewall management tool. Follow the Arch wiki guide for installation [here](https://wiki.archlinux.org/title/Firewalld).
- **KVM:** Ensure your system supports hardware-accelerated virtualization via KVM. Check the Arch guide [here](https://wiki.archlinux.org/title/KVM).

For instructions on installing Incus, refer to the [Arch wiki](https://wiki.archlinux.org/title/Incus).

# Configuring the firewall

You'll need to adjust your firewall settings to allow traffic through Incus's virtual network bridge, called _incusbr0_.

<ol>
<li>
Disable the firewall for both IPv6 and IPv4 on the network bridge:

{% highlight console %}
$ incus network set incusbr0 ipv6.firewall false
$ incus network set incusbr0 ipv4.firewall false
{% endhighlight %}
</li>
<li>
Mark the network interface as trusted in firewalld:

{% highlight console %}
$ firewall-cmd --zone=trusted --change-interface=incusbr0 --permanent
$ firewall-cmd --reload
{% endhighlight %}
</li>
</ol>

Incorrect firewall settings can block network traffic to and from your VMs, so please ensure this step is done correctly.

# Creating and starting a virtual machine

We’ll start by creating a basic virtual machine. In this example, we’ll deploy Talos, a minimal Kubernetes OS.

Please check Talos's [system requirements](https://www.talos.dev/v1.8/introduction/system-requirements/) before proceeding. Insufficient resource allocation (memory and disk) for the VM will lead to "unavailable space" error messages during the Talos installation.

<ol>
<li>
Create an Empty VM: We’ll set up a VM with 1 CPU, 4 GB RAM, and a 100 GB disk.

{% highlight console %}
$ incus init talos-1 --empty --vm -c limits.cpu=1 -c limits.memory=4GiB -d root,size=100GiB
{% endhighlight %}
</li>
<li>
Import the Talos Installation Image: We’ll import the ISO file for Talos.

{% highlight console %}
$ incus storage volume import default metal-amd64.iso talos-iso --type=iso
{% endhighlight %}
</li>
<li>
Attach the ISO to the VM: Add the Talos ISO as a bootable device to the VM.

{% highlight console %}
$ incus config device add talos-1 talos-iso disk pool=default source=talos-iso boot.priority=10
{% endhighlight %}
</li>
<li>
Start the VM: Now, start your VM.

{% highlight console %}
$ incus start talos-1
{% endhighlight %}
</li>
<li>
Connect to the VM’s Console: View the VM's VGA output by connecting to the console.

{% highlight console %}
$ incus console talos-1 --type=vga
{% endhighlight %}
</li>
</ol>

# Managing multiple VM instances

You can automate the process using a Bash script to run multiple instances of Talos or any other OS. Here’s an example script, _start.sh_, to spin up several VMs:

{% highlight bash %}
#!/bin/bash

if [ -z "$1" ]; then
  echo "Usage: $0 <number_of_instances>"
  exit 1
fi

n=$1

for ((i=1; i<=n; i++)) do
  instance_name="talos-$i"

  incus init $instance_name --empty --vm -c limits.cpu=1 -c limits.memory=4GiB -d root,size=100GiB
  incus config device add $instance_name talos-iso disk pool=default source=talos-iso boot.priority=10
  incus start $instance_name

  echo "$instance_name ✓"
done
{% endhighlight %}

Run the script by specifying the number of instances you want to create:

{% highlight console %}
$ ./start.sh 3
{% endhighlight %}

After running the script to create multiple VM instances, you can list all the running VMs along with their assigned IP addresses: 

{% highlight console %}
$ incus list
+---------+---------+----------------------+-----------------------------------------------+-----------------+-----------+
|  NAME   |  STATE  |         IPV4         |                     IPV6                      |      TYPE       | SNAPSHOTS |
+---------+---------+----------------------+-----------------------------------------------+-----------------+-----------+
| talos-1 | RUNNING | 10.158.18.138 (eth0) | fd42:e514:aeb7:60e5:216:3eff:fe2d:69f1 (eth0) | VIRTUAL-MACHINE | 0         |
+---------+---------+----------------------+-----------------------------------------------+-----------------+-----------+
| talos-2 | RUNNING | 10.158.18.254 (eth0) | fd42:e514:aeb7:60e5:216:3eff:fe4a:5f53 (eth0) | VIRTUAL-MACHINE | 0         |
+---------+---------+----------------------+-----------------------------------------------+-----------------+-----------+
| talos-3 | RUNNING | 10.158.18.125 (eth0) | fd42:e514:aeb7:60e5:216:3eff:fe03:6475 (eth0) | VIRTUAL-MACHINE | 0         |
+---------+---------+----------------------+-----------------------------------------------+-----------------+-----------+
{% endhighlight %}

## Deleting all instances

If you want to delete all the created VM instances, you can use the following command:

{% highlight console %}
$ incus list -f compact -c n | awk 'NR>1 {print $1}' | xargs -I {} incus delete --force {}
{% endhighlight %}

This command lists the names of all VM instances, filters out the header, and passes the names to `incus delete`, which forcefully deletes them.

# Web UI

You can manage Incus using its web-based interface, which, forked from LXD UI, provides a more visual and user-friendly experience. The Incus UI provides a convenient way to monitor and control your virtual machines and containers.

To install the Incus Web UI on Arch Linux, follow these steps:

<ol>
<li>
Install the Incus UI using <a href="https://github.com/Jguer/yay">yay</a>:

{% highlight console %}
$ yay -S talos-ui
{% endhighlight %}
</li>
<li>
Configure the Incus UI by setting the <em>core.https_address configuration</em> option. This allows the web interface to be accessed locally (or remotely if needed):

{% highlight console %}
$ incus config set core.https_address=127.0.0.1:8443
{% endhighlight %}
</li>
</ol>

This will bind the UI to localhost on port 8443, which you can access via a browser by navigating to [https://127.0.0.1:8443](https://127.0.0.1:8443).

<p align="center">
<img width="800px" alt="Incus UI" src="/assets/images/posts/incus/web-ui.png" />
</p>

With the Web UI, you can view running instances, manage resources, and interact with containers and VMs in a more intuitive manner, making it a helpful tool for those who prefer graphical interfaces over the command line.

# Setting up Talos and a Kubernetes cluster

Once the VMs run, you can install Talos and configure a Kubernetes cluster.

<ol>
<li>
Install Talosctl: Use yay to install the Talos command-line tool.

{% highlight console %}
$ yay -S talosctl
{% endhighlight %}
</li>
<li>
Set Up the Control Plane: Generate the cluster configuration for Talos.

{% highlight console %}
$ export CONTROL_PLANE_ID="10.158.18.138
$ talosctl gen config cluster https://$CONTROL_PLANE_ID:6443 --install-disk /dev/sda
{% endhighlight %}

Make sure to provide the correct <em>CONTROL_PLANE_ID</em> here, also make sure to provide the correct installation disk. The available disks of a VM can be listed as follows:

{% highlight console %}
$ talosctl -n $INSTANCE_IP disks --insecure
{% endhighlight %}
</li>
<li>
Apply Configuration: Apply the generated configuration to the control plane.

{% highlight console %}
$ talosctl -n $CONTROL_PLANE_ID apply-config --insecure --file controlplane.yaml
{% endhighlight %}
</li>
<li>
Configure the control plane <a href="https://www.talos.dev/v1.5/kubernetes-guides/configuration/cluster-endpoint/">endpoints</a>: Set the correct IP address for the cluster API:

{% highlight console %}
$ export TALOSCONFIG=$(realpath ./talosconfig)
$ talosctl config endpoint $CONTROL_PLANE_ID
{% endhighlight %}
</li>
<li>
Bootstrap the Control Plane: Finally, bootstrap your Kubernetes control plane.

{% highlight console %}
$ talosctl -n $CONTROL_PLANE_ID bootstrap
{% endhighlight %}
</li>
</ol>

## Adding workers to the Kubernetes cluster

To join worker nodes to the Kubernetes cluster, use the following command for each node:

{% highlight console %}
$ talosctl -n $NODE_IP apply-config --insecure --file worker.yaml
{% endhighlight %}

You can verify the cluster members with:

{% highlight console %}
$ talosctl -n $CONTROL_PLANE_ID get members
NODE            NAMESPACE   TYPE     ID        VERSION   HOSTNAME        MACHINE TYPE   OS               ADDRESSES
10.158.18.138   cluster     Member   talos-1   2         talos-1.incus   controlplane   Talos (v1.8.1)   ["10.158.18.138","fd42:e514:aeb7:60e5:216:3eff:fe2d:69f1"]
10.158.18.138   cluster     Member   talos-2   5         talos-2.incus   worker         Talos (v1.8.0)   ["10.158.18.254","fd42:e514:aeb7:60e5:216:3eff:fe4a:5f53"]
10.158.18.138   cluster     Member   talos-3   2         talos-3.incus   worker         Talos (v1.8.1)   ["10.158.18.125","fd42:e514:aeb7:60e5:216:3eff:fe03:6475"]
{% endhighlight %}

## Accessing Kubernetes with kubectl

Once the cluster is set up, download the kubeconfig file and start interacting with Kubernetes using kubectl:

{% highlight console %}
$ talosctl -n $CONTROL_PLANE_ID kubeconfig ./kubeconfig
$ kubectl --kubeconfig ./kubeconfig get node -owide
NAME      STATUS   ROLES           AGE     VERSION   INTERNAL-IP     EXTERNAL-IP   OS-IMAGE         KERNEL-VERSION   CONTAINER-RUNTIME
talos-1   Ready    control-plane   4m53s   v1.31.1   10.158.18.138   <none>        Talos (v1.8.1)   6.6.54-talos     containerd://2.0.0-rc.5
talos-2   Ready    <none>          3m11s   v1.31.1   10.158.18.254   <none>        Talos (v1.8.1)   6.6.54-talos     containerd://2.0.0-rc.5
talos-3   Ready    <none>          3m8s    v1.31.1   10.158.18.125   <none>        Talos (v1.8.1)   6.6.54-talos     containerd://2.0.0-rc.5
{% endhighlight %}

# Finally

Following these steps, you can efficiently deploy and manage VMs using Incus, install Talos, and create a Kubernetes cluster on Arch Linux. Incus provides a fast and versatile virtualization platform, while Talos offers a lightweight OS optimized for Kubernetes deployments.

For more detailed documentation, refer to:

- [https://linuxcontainers.org/incus/docs/main/](https://linuxcontainers.org/incus/docs/main/)
- [https://www.talos.dev/v1.8/](https://www.talos.dev/v1.8/)
